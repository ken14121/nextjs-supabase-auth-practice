import type {
  LatLng,
  TimelineSegment,
  TimelineVisit,
  TransportMode,
} from "./parse";

// 滞在と移動の並びを、「家を出てから戻るまで」の外出ごとに区切る。

// 自宅からこの距離以内の場所は記録しない（自宅の位置を残さない・友達に見せないため）
export const HOME_RADIUS_KM = 1.5;

export type Stop = { location: LatLng; at: string };

export type OutingDraft = {
  startedAt: string;
  endedAt: string;
  nights: number;
  distanceKm: number;
  mainTransport: TransportMode | null;
  // 立ち寄った場所（自宅の周りは除く）。ここから県・国を判定する
  stops: Stop[];
};

// 2 点間の距離（km）。地球を球とみなして計算する
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 自宅の位置を決める。
// 「Home」と記録された滞在があればそれを使い、なければ一番長く滞在した場所を自宅とみなす。
function findHomes(visits: TimelineVisit[]): LatLng[] {
  const marked = visits.filter((v) => v.isHome).map((v) => v.location);
  if (marked.length > 0) {
    // 引っ越しで自宅が複数あっても対応できるよう、約 100m 単位でまとめて全部使う
    const unique = new Map<string, LatLng>();
    for (const loc of marked) {
      unique.set(`${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`, loc);
    }
    return [...unique.values()];
  }

  const stayMs = new Map<string, { loc: LatLng; ms: number }>();
  for (const v of visits) {
    const key = `${v.location.lat.toFixed(3)},${v.location.lng.toFixed(3)}`;
    const ms = Date.parse(v.end) - Date.parse(v.start);
    const current = stayMs.get(key);
    stayMs.set(key, { loc: v.location, ms: (current?.ms ?? 0) + ms });
  }
  const longest = [...stayMs.values()].sort((a, b) => b.ms - a.ms)[0];
  return longest ? [longest.loc] : [];
}

// 日本時間の 3:00 を何回またいだか ＝ 何泊したか
// （22 時に出て 1 時に帰るのは 0 泊、2 日後の夜に帰るのは 2 泊）
function countNights(startIso: string, endIso: string): number {
  const DAY = 24 * 60 * 60 * 1000;
  const JST_3AM_IN_UTC = 18 * 60 * 60 * 1000; // 日本時間 3:00 = 前日の UTC 18:00
  const start = Math.floor((Date.parse(startIso) - JST_3AM_IN_UTC) / DAY);
  const end = Math.floor((Date.parse(endIso) - JST_3AM_IN_UTC) / DAY);
  return Math.max(0, end - start);
}

function summarize(
  segments: TimelineSegment[],
  isNearHome: (loc: LatLng) => boolean,
): OutingDraft | null {
  const stops: Stop[] = [];
  const distanceByMode = new Map<TransportMode, number>();
  let totalMeters = 0;

  for (const seg of segments) {
    if (seg.kind === "visit") {
      if (!isNearHome(seg.location)) {
        stops.push({ location: seg.location, at: seg.start });
      }
    } else {
      totalMeters += seg.distanceMeters;
      distanceByMode.set(
        seg.mode,
        (distanceByMode.get(seg.mode) ?? 0) + seg.distanceMeters,
      );
      if (!isNearHome(seg.from))
        stops.push({ location: seg.from, at: seg.start });
      if (!isNearHome(seg.to)) stops.push({ location: seg.to, at: seg.end });
    }
  }

  // 自宅の周りから出ていない外出（近所の散歩など）は記録しない
  if (stops.length === 0) return null;

  const mainTransport =
    [...distanceByMode.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    startedAt: first.start,
    endedAt: last.end,
    nights: countNights(first.start, last.end),
    distanceKm: Math.round(totalMeters / 100) / 10,
    mainTransport,
    stops,
  };
}

export function buildOutings(segments: TimelineSegment[]): OutingDraft[] {
  const sorted = [...segments].sort((a, b) => a.start.localeCompare(b.start));
  const homes = findHomes(
    sorted.filter((s): s is TimelineVisit => s.kind === "visit"),
  );
  const isNearHome = (loc: LatLng) =>
    homes.some((home) => distanceKm(home, loc) <= HOME_RADIUS_KM);

  const outings: OutingDraft[] = [];
  let current: TimelineSegment[] = [];

  const finish = () => {
    if (current.length > 0) {
      const outing = summarize(current, isNearHome);
      if (outing) outings.push(outing);
    }
    current = [];
  };

  for (const seg of sorted) {
    if (seg.kind === "visit") {
      if (seg.isHome || isNearHome(seg.location)) {
        finish();
      } else {
        current.push(seg);
      }
      continue;
    }
    // 自宅の周りで始まって終わる移動（近所の散歩など）は外出に含めない
    if (current.length === 0 && isNearHome(seg.to)) continue;
    current.push(seg);
    // 自宅の周りに戻ってきた移動で、外出を締めくくる。
    // 帰宅後に「自宅での滞在」が記録されないことがあり、そのままだと翌日の外出とつながってしまうため
    if (isNearHome(seg.to)) finish();
  }
  finish();

  return outings;
}

// 日本時間での日付（YYYY-MM-DD）
export function toJstDate(iso: string): string {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  return new Date(Date.parse(iso) + JST_OFFSET).toISOString().slice(0, 10);
}
