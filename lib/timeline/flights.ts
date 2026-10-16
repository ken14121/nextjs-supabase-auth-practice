import type { AirportHit } from "@/lib/geo/airports";
import { distanceKm as straightKm } from "./outings";
import type { LatLng, TimelineSegment } from "./parse";

// タイムラインから、搭乗券にする便を取り出す。保存するのは空港コードと時刻と距離だけ（座標は保存しない）。
//
// 便とみなすもの:
//   1. 「飛行機」の移動（80 km より短いものは、車や電車の誤判定として除く）
//   2. 種類が「飛行機」でなくても、飛行機でしかありえない速さの移動
//   3. 記録の空白のあいだに、飛行機でしかありえない速さで遠くへ動いていたもの
//      （機内で位置が取れず、移動の記録そのものが無いことがある）
//
// 出発・到着の空港は、移動の始点・終点に一番近い空港。ただし始点・終点が空港から離れているとき
// （飛び立ってから記録が始まった など）は、直前・直後に地上にいた場所の近くの空港を使う

export type FlightDraft = {
  departedAt: string;
  arrivedAt: string;
  from: string | null;
  to: string | null;
  distanceKm: number;
};

type FindAirport = (lat: number, lng: number) => AirportHit | null;

const MIN_FLIGHT_KM = 80;
// 2・3 の条件。新幹線は平均で時速 250 km に届かないので、300 km/h 以上は飛行機とみなす。
// 時速 1,000 km を超えるものは、位置の飛び（記録の誤り）として除く
const FAST_MIN_KM = 300;
const FAST_MIN_KMH = 300;
const FAST_MAX_KMH = 1000;
const GAP_MIN_MINUTES = 30;
// 始点・終点がこれより空港に近ければ、その空港をそのまま使う
const AT_AIRPORT_KM = 10;
// 直前・直後に地上にいた場所からこれだけ離れた端は、飛行中に記録された位置とみなす
const IN_AIR_KM = 50;
// 直前・直後に地上にいた場所を使うのは、これより時間が離れていないときだけ
const NEIGHBOR_HOURS = 3;

const endOf = (s: TimelineSegment): LatLng =>
  s.kind === "visit" ? s.location : s.to;
const startOf = (s: TimelineSegment): LatLng =>
  s.kind === "visit" ? s.location : s.from;
const hoursBetween = (a: string, b: string) =>
  (Date.parse(b) - Date.parse(a)) / 3_600_000;
const round1 = (km: number) => Math.round(km * 10) / 10;

function isFast(km: number, hours: number) {
  if (km < FAST_MIN_KM || hours <= 0) return false;
  const kmh = km / hours;
  return kmh >= FAST_MIN_KMH && kmh <= FAST_MAX_KMH;
}

// 飛行機の移動（1・2）か
const isFlightLike = (s: TimelineSegment | undefined) =>
  s?.kind === "activity" &&
  (s.mode === "flight" ||
    isFast(straightKm(s.from, s.to), hoursBetween(s.start, s.end)));

// 移動の端の空港。
//   ・直前・直後に地上にいた場所から 50 km 以上離れていれば、端は飛行中の位置とみなし、地上にいた場所の空港
//   ・端が空港の近くなら、その空港
//   ・どちらでもなければ、端と地上にいた場所のうち、空港に近い方
function pickAirport(
  find: FindAirport,
  edge: LatLng,
  neighbor: LatLng | null,
): string | null {
  const near = neighbor ? find(neighbor.lat, neighbor.lng) : null;
  if (near && neighbor && straightKm(edge, neighbor) >= IN_AIR_KM) {
    return near.code;
  }
  const own = find(edge.lat, edge.lng);
  if (own && own.km <= AT_AIRPORT_KM) return own.code;
  if (near && (!own || near.km < own.km)) return near.code;
  return own?.code ?? null;
}

export function extractFlights(
  segments: TimelineSegment[],
  findAirport: FindAirport,
): FlightDraft[] {
  const sorted = [...segments].sort((a, b) => a.start.localeCompare(b.start));
  const flights: FlightDraft[] = [];
  // ここまでで一番あとに終わった記録（空港での滞在が重なって複数あることがあるので、
  // 「直前の記録」は並びの 1 つ前ではなく、終わりが一番遅いもの）
  let last: TimelineSegment | undefined;

  for (const [i, s] of sorted.entries()) {
    const prev = last;
    if (!last || s.end > last.end) last = s;
    const next = sorted[i + 1];

    // 3. 前の記録の終わりから、この記録までのあいだに、遠くへ動いている
    //   （隣が飛行機の移動なら、機内で記録が途切れただけなので数えない）
    if (prev && !isFlightLike(prev) && !isFlightLike(s)) {
      const gap = hiddenFlight(prev, s);
      if (gap) {
        flights.push({
          departedAt: gap.departedAt,
          arrivedAt: gap.arrivedAt,
          from: findAirport(gap.fromAt.lat, gap.fromAt.lng)?.code ?? null,
          to: findAirport(gap.toAt.lat, gap.toAt.lng)?.code ?? null,
          distanceKm: gap.distanceKm,
        });
        continue;
      }
    }

    if (s.kind !== "activity" || !isFlightLike(s)) continue;
    const straight = straightKm(s.from, s.to);

    // 直前・直後に地上にいた場所（時間が離れすぎていなければ）
    const before =
      prev && hoursBetween(prev.end, s.start) <= NEIGHBOR_HOURS
        ? endOf(prev)
        : null;
    const after =
      next && hoursBetween(s.end, next.start) <= NEIGHBOR_HOURS
        ? startOf(next)
        : null;

    // 記録に距離が無いこともあるので、始点と終点の直線距離と比べて長い方。
    // 機内で記録が途切れて短く見えるときは、直前・直後の地上の場所どうしの距離も見る
    let km = Math.max(s.distanceMeters / 1000, straight);
    if (km < MIN_FLIGHT_KM && before && after) {
      km = Math.max(km, straightKm(before, after));
    }
    if (km < MIN_FLIGHT_KM) continue;

    flights.push({
      departedAt: s.start,
      arrivedAt: s.end,
      from: pickAirport(findAirport, s.from, before),
      to: pickAirport(findAirport, s.to, after),
      distanceKm: round1(km),
    });
  }

  return flights;
}

// 「飛行機」の記録が無いまま飛んだ便を、前後の記録から見つける。
//   ・前の記録の終わりから次の記録の始まりまでの空白に、飛行機の速さで遠くへ動いている
//   ・空白が短すぎる（着いたあとの車や電車の移動に、飛行機の時間が混ざって記録された）ときは、
//     次の移動の終わりまでを 1 つの便とみなす
function hiddenFlight(
  prev: TimelineSegment,
  s: TimelineSegment,
):
  | (Omit<FlightDraft, "from" | "to"> & { fromAt: LatLng; toAt: LatLng })
  | null {
  const fromAt = endOf(prev);
  const jumpTo = startOf(s);
  const jumpKm = straightKm(fromAt, jumpTo);
  if (jumpKm < FAST_MIN_KM) return null;

  const hours = hoursBetween(prev.end, s.start);
  if (hours * 60 >= GAP_MIN_MINUTES && isFast(jumpKm, hours)) {
    return {
      departedAt: prev.end,
      arrivedAt: s.start,
      fromAt,
      toAt: jumpTo,
      distanceKm: round1(jumpKm),
    };
  }
  if (s.kind === "activity") {
    const km = straightKm(fromAt, s.to);
    if (isFast(km, hoursBetween(prev.end, s.end))) {
      return {
        departedAt: prev.end,
        arrivedAt: s.end,
        fromAt,
        toAt: s.to,
        distanceKm: round1(km),
      };
    }
  }
  return null;
}
