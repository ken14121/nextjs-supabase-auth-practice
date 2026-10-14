import { distanceKm as straightKm } from "./outings";
import type { TimelineSegment } from "./parse";

// タイムラインの「飛行機での移動」から、搭乗券にする便を取り出す。
// 出発・到着の空港は、移動の始点・終点に一番近い空港（lib/geo/airports.ts）。
// 保存するのは空港コードと時刻と距離だけ（座標は保存しない）

export type FlightDraft = {
  departedAt: string;
  arrivedAt: string;
  from: string | null;
  to: string | null;
  distanceKm: number;
};

// これより短い「飛行機」は、Google の判定違い（車や電車の誤判定）とみなして除く
const MIN_FLIGHT_KM = 80;

export function extractFlights(
  segments: TimelineSegment[],
  nearestAirport: (lat: number, lng: number) => string | null,
): FlightDraft[] {
  return segments.flatMap((s) => {
    if (s.kind !== "activity" || s.mode !== "flight") return [];
    // 記録に距離が無いこともあるので、始点と終点の直線距離と比べて長い方
    const distanceKm =
      Math.round(
        Math.max(s.distanceMeters / 1000, straightKm(s.from, s.to)) * 10,
      ) / 10;
    if (distanceKm < MIN_FLIGHT_KM) return [];
    return [
      {
        departedAt: s.start,
        arrivedAt: s.end,
        from: nearestAirport(s.from.lat, s.from.lng),
        to: nearestAirport(s.to.lat, s.to.lng),
        distanceKm,
      },
    ];
  });
}
