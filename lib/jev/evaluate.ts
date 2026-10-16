import { OUTING_LABEL_VALUES, type OutingLabel } from "@/lib/outings/labels";
import { decideLabel, UNSURE_BELOW } from "./decide";

// 本人が確かめた外出（Jev の答えと本人の答えの両方がある）から、
// Jev の正解率と、確率がどれくらい当てになるかを数える

export type ReviewedOuting = {
  jevLabel: OutingLabel;
  userLabel: OutingLabel;
  jevConfidence: number | null;
  jevPDaily: number | null;
};

export type CalibrationBin = {
  from: number;
  to: number;
  count: number;
  // その範囲で Jev が言った確率の平均
  meanPredicted: number | null;
  // 実際にそうだった割合
  actualRate: number | null;
};

const rate = (hit: number, all: number) => (all > 0 ? hit / all : null);

export function evaluateJev(rows: ReviewedOuting[]) {
  const correct = rows.filter((r) => r.jevLabel === r.userLabel).length;

  // 対応表：行 = Jev の答え、列 = 本人の答え
  const confusion = Object.fromEntries(
    OUTING_LABEL_VALUES.map((jev) => [
      jev,
      Object.fromEntries(
        OUTING_LABEL_VALUES.map((user) => [
          user,
          rows.filter((r) => r.jevLabel === jev && r.userLabel === user).length,
        ]),
      ),
    ]),
  ) as Record<OutingLabel, Record<OutingLabel, number>>;

  // 「要確認」が付いたもの・付かなかったもの、それぞれの正解率
  const bySureness = [
    { name: "要確認なし", test: (c: number) => c >= UNSURE_BELOW },
    { name: "要確認あり", test: (c: number) => c < UNSURE_BELOW },
  ].map(({ name, test }) => {
    const group = rows.filter(
      (r) => r.jevConfidence !== null && test(r.jevConfidence),
    );
    return {
      name,
      count: group.length,
      accuracy: rate(
        group.filter((r) => r.jevLabel === r.userLabel).length,
        group.length,
      ),
    };
  });

  // 確率の当てはまり：「日常か？」の確率を 20% ごとに分けて、実際に日常だった割合と比べる。
  // 確率が正しければ、たとえば 60〜80% の行では、実際にも 6〜8 割が日常になるはず
  const withP = rows.filter(
    (r): r is ReviewedOuting & { jevPDaily: number } => r.jevPDaily !== null,
  );
  // 0〜20% を 0 番、…、80〜100% を 4 番の箱に入れる（小数の比較のずれを避けるため番号で分ける）
  const BINS = 5;
  const binOf = (p: number) => Math.min(BINS - 1, Math.floor(p * BINS));
  const dailyCalibration: CalibrationBin[] = Array.from(
    { length: BINS },
    (_, i) => {
      const bin = withP.filter((r) => binOf(r.jevPDaily) === i);
      return {
        from: i / BINS,
        to: (i + 1) / BINS,
        count: bin.length,
        meanPredicted:
          bin.length > 0
            ? bin.reduce((sum, r) => sum + r.jevPDaily, 0) / bin.length
            : null,
        actualRate: rate(
          bin.filter((r) => r.userLabel === "daily").length,
          bin.length,
        ),
      };
    },
  );

  return {
    total: rows.length,
    correct,
    accuracy: rate(correct, rows.length),
    confusion,
    bySureness,
    dailyCalibration,
  };
}

// 「日常」の境目を変えたら、確かめた外出のうち何件当たっていたか。
// Jev の答え（3 つの確率）は保存してあるので、Jev に聞き直さずに計算できる。
// byRule の外出は、Jev に聞く前にルールで日常に決まるので、境目に関係なく日常
export type ThresholdRow = {
  userLabel: OutingLabel;
  nights: number;
  pDaily: number;
  pHomecoming: number;
  pDayTrip: number;
  byRule: boolean;
};

export function accuracyByDailyThreshold(
  rows: ThresholdRow[],
  thresholds: number[],
) {
  return thresholds.map((threshold) => {
    const correct = rows.filter((r) => {
      const label = r.byRule
        ? "daily"
        : decideLabel({ ...r, dailyThreshold: threshold }).label;
      return label === r.userLabel;
    }).length;
    return { threshold, correct, accuracy: rate(correct, rows.length) };
  });
}
