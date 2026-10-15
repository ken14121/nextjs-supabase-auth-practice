import { FREQUENT_DAYS, type JevContext } from "@/lib/jev/state";
import type { OutingLabel } from "@/lib/outings/labels";
import { isClearlyDaily, type OutingFeatures } from "@/lib/timeline/features";

// Jev を使わずに、コードのルールだけで外出の種類を決める（Jev が使えないときの代わり）。
// 材料は Jev に渡しているものと同じ（泊数・自宅から一番遠い地点・いつもの場所 / ふだん行かない場所にいた時間・
// 行った都道府県と、そこにこれまで行った日数）。
//
//   泊まっていない
//     いつもの場所だけ・家の近くだけ → 日常（今までのルール）
//     自宅から DAY_TRIP_KM 以上離れた → 日帰り
//     ふだん行かない場所に OUTING_RARE_MINUTES 以上いた → おでかけ
//     それ以外 → 日常
//   泊まった
//     住んでいる都道府県から出ず、近い → 日常（学校・友人宅に泊まった など）
//     よく行く場所（FREQUENT_DAYS 日以上）でも、近ければ → 日常（隣の県の友人宅など）
//     よく行く場所で、遠い（HOMECOMING_KM 以上）→ 帰省
//     それ以外 → 旅行
//
// 数字は本人が確かめた外出で正解率を見ながら決める（/outings/review）

export const DAY_TRIP_KM = 50;
export const OUTING_RARE_MINUTES = 60;
// 泊まっても、住んでいる都道府県から出ずにこの距離より近ければ日常
export const STAY_NEAR_KM = 30;
// 帰省とみなすのは、よく行く場所がこれより遠いとき
export const HOMECOMING_KM = 50;

export type RuleInput = {
  nights: number;
  distance_km: number;
  region_codes: string[];
  features: OutingFeatures | null;
};

export type RuleJudgement = {
  label: OutingLabel;
  // どのルールで決まったか（画面と確かめるページに出す）
  reason: string;
};

export function ruleJudge(outing: RuleInput, ctx: JevContext): RuleJudgement {
  const f = outing.features;
  // 地点の数字が無い外出（取り込み直す前のもの）は、移動した距離の半分を「一番遠い地点」の目安にする
  const farKm = f ? f.maxKmFromHome : outing.distance_km / 2;
  const away = [...new Set(outing.region_codes)].filter(
    (code) => code !== ctx.homeRegion,
  );

  if (outing.nights === 0) {
    if (f && isClearlyDaily(0, f)) {
      return { label: "daily", reason: "いつもの場所・家の近くだけ" };
    }
    if (farKm >= DAY_TRIP_KM) {
      return { label: "day_trip", reason: `自宅から ${DAY_TRIP_KM} km 以上` };
    }
    if (f && f.rareMinutes >= OUTING_RARE_MINUTES) {
      return { label: "outing", reason: "ふだん行かない場所に 1 時間以上" };
    }
    return { label: "daily", reason: "近くで、いつもの場所が中心" };
  }

  if (away.length === 0 && farKm < STAY_NEAR_KM) {
    return { label: "daily", reason: "泊まったが、住んでいる県の近く" };
  }
  // 一番長くいた行き先ではなく「よく行く場所」があるかで見る（実家・地元は何十日も行っている）
  const frequent = away.some(
    (code) => (ctx.visitedDays.get(code) ?? 0) >= FREQUENT_DAYS,
  );
  if (frequent && farKm < HOMECOMING_KM) {
    return { label: "daily", reason: "よく行く近くの場所に泊まり" };
  }
  if (frequent) {
    return {
      label: "homecoming",
      reason: `${FREQUENT_DAYS} 日以上行っている遠くの場所へ泊まり`,
    };
  }
  return { label: "trip", reason: "ふだん行かない場所へ泊まり" };
}
