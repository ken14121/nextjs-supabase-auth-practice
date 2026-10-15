import { FREQUENT_DAYS, type JevContext, seasonOf } from "@/lib/jev/state";
import type { OutingLabel } from "@/lib/outings/labels";
import { isClearlyDaily, type OutingFeatures } from "@/lib/timeline/features";

// Jev を使わずに、コードのルールだけで外出の種類を決める（Jev が使えないときの代わり）。
// 材料は Jev に渡しているものと同じ（泊数・自宅から一番遠い地点・いつもの場所 / ふだん行かない場所にいた時間・
// 行った都道府県と、そこにこれまで行った日数）。
//
//   泊まっていない
//     いつもの場所だけ・家の近くだけ → 日常（今までのルール）
//     自宅から DAY_TRIP_KM 以上離れた → 日帰り
//     いつもの場所以外に OUTING_MINUTES 以上いた → おでかけ
//     それ以外 → 日常
//   泊まった
//     住んでいる都道府県から出ず、近い → 日常（学校・友人宅に泊まった など）
//     よく行く場所（FREQUENT_DAYS 日以上）でも、近ければ → 日常（隣の県の友人宅など）
//     よく行く遠くの場所（HOMECOMING_KM 以上）へ、年末年始・GW・お盆に泊まった → 帰省
//     （時期で絞らないと、何度も旅行で行く場所まで帰省になった。本人の 81 件で 4 件とも外れ）
//     （本人が「帰省はほとんどない」と設定していれば、帰省にはしない）
//     それ以外 → 旅行
//
// 数字は本人が確かめた外出で正解率を見ながら決める（/outings/review）

export const DAY_TRIP_KM = 50;
// 本人が確かめた 81 件で、境目を変えたときの正解率を比べて決めた（10/15）。
//   ふだん行かない場所だけで見る：30〜180 分のどれでも 73〜75%
//   いつもの場所以外ぜんぶで見る：90 分 78%・120 分 83%・180 分 83%
// 120 分と 180 分が同じで安定しているので、短い方の 120 分（2 時間）にした。Jev（84%）とほぼ同じ
export const OUTING_MINUTES = 120;
// おでかけかどうかを見る時間：ふだん行かない場所だけ（rare）か、いつもの場所以外ぜんぶ（notUsual = ときどき + ふだん行かない）か
export type OutingMinutesOf = "rare" | "notUsual";
export const OUTING_MINUTES_OF: OutingMinutesOf = "notUsual";

// 境目を変えたらどうなるかを、確かめるページで計算するときに変える
export type RuleOptions = {
  outingMinutes?: number;
  outingMinutesOf?: OutingMinutesOf;
};
// 泊まっても、住んでいる都道府県から出ずにこの距離より近ければ日常
export const STAY_NEAR_KM = 30;
// 帰省とみなすのは、よく行く場所がこれより遠いとき
export const HOMECOMING_KM = 50;

export type RuleInput = {
  started_at: string;
  ended_at: string;
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

export function ruleJudge(
  outing: RuleInput,
  ctx: JevContext,
  options: RuleOptions = {},
): RuleJudgement {
  const outingMinutes = options.outingMinutes ?? OUTING_MINUTES;
  const minutesOf = options.outingMinutesOf ?? OUTING_MINUTES_OF;
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
    const awayMinutes = f
      ? minutesOf === "rare"
        ? f.rareMinutes
        : f.rareMinutes + f.sometimesMinutes
      : 0;
    if (f && awayMinutes >= outingMinutes) {
      return {
        label: "outing",
        reason: `いつもの場所以外に ${outingMinutes} 分以上`,
      };
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
  if (
    frequent &&
    ctx.homecoming !== false &&
    seasonOf(outing.started_at, outing.ended_at)
  ) {
    return {
      label: "homecoming",
      reason: `${FREQUENT_DAYS} 日以上行っている遠くの場所へ泊まり`,
    };
  }
  return { label: "trip", reason: "ふだん行かない場所へ泊まり" };
}
