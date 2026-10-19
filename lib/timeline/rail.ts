import { distanceKm as straightKm } from "./outings";
import type { TimelineSegment } from "./parse";

// タイムラインの「電車での移動」のうち、新幹線に乗ったらしいものを取り出して、切符にする。
//   ・乗った駅・降りた駅が、どちらも新幹線の駅の近く（3km 以内）
//   ・30km 以上を、平均時速 80km 以上（始点と終点の直線距離で計算）で移動した
// 保存するのは駅（新幹線の駅の一覧の id）と時刻と距離だけ（座標は保存しない）

export type RailRideDraft = {
  departedAt: string;
  arrivedAt: string;
  from: string;
  to: string;
  distanceKm: number;
};

const MIN_RIDE_KM = 30;
const MIN_AVERAGE_KMH = 80;

export function extractShinkansenRides(
  segments: TimelineSegment[],
  nearestStation: (lat: number, lng: number) => string | null,
): RailRideDraft[] {
  return segments.flatMap((s) => {
    if (s.kind !== "activity" || s.mode !== "train") return [];
    const straight = straightKm(s.from, s.to);
    const hours = (Date.parse(s.end) - Date.parse(s.start)) / 3_600_000;
    if (
      straight < MIN_RIDE_KM ||
      hours <= 0 ||
      straight / hours < MIN_AVERAGE_KMH
    ) {
      return [];
    }
    const from = nearestStation(s.from.lat, s.from.lng);
    const to = nearestStation(s.to.lat, s.to.lng);
    if (!from || !to || from === to) return [];
    return [
      {
        departedAt: s.start,
        arrivedAt: s.end,
        from,
        to,
        distanceKm:
          Math.round(Math.max(s.distanceMeters / 1000, straight) * 10) / 10,
      },
    ];
  });
}
