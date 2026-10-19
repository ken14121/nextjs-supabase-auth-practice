import { z } from "zod";
import { distanceKm, type OutingDraft, toJstDate } from "./outings";
import type { LatLng } from "./parse";

// 「よく行く地点（学校・バイト先・最寄り駅など）」をタイムライン全体から見つけ、
// 外出ごとに「いつもの場所にいた時間」「ふだん行かない場所にいた時間」を数える。
// 都道府県だけでは「学校に行った日」と「渋谷に遊びに行った日」が区別できないため。
//
// DB には座標を残さず、ここで数えた数字だけを保存する（outings.features）。

// この距離以内なら「同じ地点」とみなす
const SAME_PLACE_KM = 0.5;
// これ以上の日数行っている地点は「いつもの場所」
export const FREQUENT_PLACE_DAYS = 10;
// これ以下の日数しか行っていない地点は「ふだん行かない場所」
export const RARE_PLACE_DAYS = 3;
// これより短い滞在は、乗り換えなどとみなして「ふだん行かない場所の数」に入れない
const MEANINGFUL_STAY_MINUTES = 15;

export const outingFeaturesSchema = z.object({
  maxKmFromHome: z.number(),
  frequentMinutes: z.number(),
  sometimesMinutes: z.number(),
  rareMinutes: z.number(),
  rarePlaces: z.number(),
});
export type OutingFeatures = z.infer<typeof outingFeaturesSchema>;

// 地図を約 500m 四方のマスに分けて、近くの地点だけを比べる（全部と比べると遅いため）
const CELL_LAT = 0.0045;
const CELL_LNG = 0.0055;
const cellOf = (loc: LatLng) =>
  [Math.floor(loc.lat / CELL_LAT), Math.floor(loc.lng / CELL_LNG)] as const;

export function computeOutingFeatures(drafts: OutingDraft[]): OutingFeatures[] {
  // 滞在（minutes > 0）した地点と日付を、マスごとに並べる
  const cells = new Map<string, { location: LatLng; day: string }[]>();
  for (const draft of drafts) {
    for (const stop of draft.stops) {
      if (stop.minutes <= 0) continue;
      const [y, x] = cellOf(stop.location);
      const key = `${y},${x}`;
      const list = cells.get(key) ?? [];
      list.push({ location: stop.location, day: toJstDate(stop.at) });
      cells.set(key, list);
    }
  }

  // その地点から 500m 以内に、何日行っているか
  const daysAround = (loc: LatLng): number => {
    const [y, x] = cellOf(loc);
    const days = new Set<string>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const v of cells.get(`${y + dy},${x + dx}`) ?? []) {
          if (distanceKm(loc, v.location) <= SAME_PLACE_KM) days.add(v.day);
        }
      }
    }
    return days.size;
  };

  return drafts.map((draft) => {
    let frequentMinutes = 0;
    let sometimesMinutes = 0;
    let rareMinutes = 0;
    let rarePlaces = 0;
    for (const stop of draft.stops) {
      if (stop.minutes <= 0) continue;
      const days = daysAround(stop.location);
      if (days >= FREQUENT_PLACE_DAYS) {
        frequentMinutes += stop.minutes;
      } else if (days <= RARE_PLACE_DAYS) {
        rareMinutes += stop.minutes;
        if (stop.minutes >= MEANINGFUL_STAY_MINUTES) rarePlaces++;
      } else {
        sometimesMinutes += stop.minutes;
      }
    }
    return {
      maxKmFromHome: draft.maxKmFromHome,
      frequentMinutes,
      sometimesMinutes,
      rareMinutes,
      rarePlaces,
    };
  });
}

// Jev に聞かなくても「日常」と決めてよい外出か（泊まっていない日だけ）。
//   ・ふだん行かない場所・ときどき行く場所にほとんどいなかった日（学校・バイト・最寄り駅だけの日）
//   ・家の近所だけの日
// Jev のクレジットを使わずに済む
// 家の近所（この距離以内）だけの外出は、知らない場所でもバイトや買い物の可能性が高いので日常にする
//（10/8 に本人が 57 件を確かめたとき、近所の「おでかけ」判定を日常に直すことが多かったため）
export const NEAR_HOME_KM = 5;

export function isClearlyDaily(nights: number, f: OutingFeatures): boolean {
  if (nights > 0) return false;
  const onlyUsualPlaces = f.rareMinutes < 30 && f.sometimesMinutes < 60;
  const onlyNearHome = f.maxKmFromHome <= NEAR_HOME_KM;
  return onlyUsualPlaces || onlyNearHome;
}
