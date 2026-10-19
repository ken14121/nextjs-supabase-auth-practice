import type { OutingLabel } from "@/lib/outings/labels";

// Jev の 3 つの「はい / いいえ」の答え（はいの確率）と、コードで数えた泊数から、
// 外出の種類を 1 つに決める。
//
//   日常か？ ──はい──→ 日常
//      │いいえ
//   泊まったか？（コードで判断）──いいえ──→ 遠くへの日帰り旅行か？ ──はい──→ 日帰り / いいえ → おでかけ
//      │はい
//   帰省か？ ──はい──→ 帰省 / いいえ → 旅行
//
// 4 択（Choice）でまとめて聞かないのは、選択肢の並び順で答えが偏ることがあるため
// （サイコロの目を Choice で聞くと、いつも 1 つめを選んだという検証がある）。

export const YES_THRESHOLD = 0.5;
// 「日常か？」だけは、境目を少し下げる。本人が 81 件を確かめたところ、Jev が日常の確率を
// 40〜60% と言った外出の 9 割が実際は日常だった（57 件のときも同じ傾向）。
// 境目を 40% と 45% にしたときの正解率は同じ（81 件中 68 件、50% だと 66 件）なので、動かす幅が小さい 45% にした。
// 45〜50% で日常になった外出は確かさも 50% 未満なので、「要確認」が付く（docs/JEV.md）
export const DAILY_THRESHOLD = 0.45;
// これより低いときは「要確認」として本人に見てもらう
export const UNSURE_BELOW = 0.7;

export function decideLabel(input: {
  nights: number;
  pDaily: number;
  pHomecoming: number;
  pDayTrip: number;
  // 「日常」と決める境目（ふだんは DAILY_THRESHOLD。確かめるページで、境目を変えたらどうなるかを計算するときに変える）
  dailyThreshold?: number;
}): { label: OutingLabel; confidence: number } {
  const { nights, pDaily, pHomecoming, pDayTrip } = input;
  const dailyThreshold = input.dailyThreshold ?? DAILY_THRESHOLD;
  if (pDaily >= dailyThreshold) return { label: "daily", confidence: pDaily };
  if (nights === 0) {
    return pDayTrip >= YES_THRESHOLD
      ? { label: "day_trip", confidence: Math.min(1 - pDaily, pDayTrip) }
      : { label: "outing", confidence: Math.min(1 - pDaily, 1 - pDayTrip) };
  }
  // 2 つの答えを通って決まるときは、確かさの低い方を使う
  //（掛け算にすると、はっきりした旅行でも 0.85 × 0.8 = 0.68 のように低く出てしまうため）
  return pHomecoming >= YES_THRESHOLD
    ? { label: "homecoming", confidence: Math.min(1 - pDaily, pHomecoming) }
    : { label: "trip", confidence: Math.min(1 - pDaily, 1 - pHomecoming) };
}
