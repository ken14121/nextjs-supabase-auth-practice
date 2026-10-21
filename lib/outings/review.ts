import { evaluateJev } from "@/lib/jev/evaluate";
import type { JevContext } from "@/lib/jev/state";
import { OUTING_LABEL_VALUES, type OutingLabel } from "./labels";
import { type RuleInput, type RuleOptions, ruleJudge } from "./rule-judge";

// 確かめるページ（/outings/review）で使う、外出の分け方と数え方

export const isOutingLabel = (v: string | null): v is OutingLabel =>
  (OUTING_LABEL_VALUES as readonly (string | null)[]).includes(v);

type ReviewRow = {
  label: string | null;
  label_source: string | null;
  jev_label: string | null;
};

// 確かめた外出と、まだ確かめていない外出に分ける。
//   ・Jev を使える人（本人）は、Jev の答えを確かめる（Jev の答えが残っている外出だけ）
//   ・それ以外の人は、アプリのルールの答えを確かめる。ルールの答えは保存してある材料から
//     いつでも計算し直せるので、本人が決めた答え（label_source = 'user'）があれば比べられる
export function splitForReview<T extends ReviewRow>(rows: T[], jev: boolean) {
  return {
    reviewed: rows.filter(
      (o) =>
        o.label_source === "user" &&
        isOutingLabel(o.label) &&
        (!jev || isOutingLabel(o.jev_label)),
    ),
    unchecked: rows.filter((o) => o.label_source === (jev ? "jev" : "rule")),
  };
}

// ルールだけで判定していたら、本人の答えと何件合っていたか
export function evaluateRuleJudge(
  rows: (RuleInput & { userLabel: OutingLabel })[],
  ctx: JevContext,
  options?: RuleOptions,
) {
  return evaluateJev(
    rows.map((r) => ({
      jevLabel: ruleJudge(r, ctx, options).label,
      userLabel: r.userLabel,
      jevConfidence: null,
      jevPDaily: null,
    })),
  );
}
