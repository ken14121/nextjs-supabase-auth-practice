// 外出の種類（label）。Jev の判定と、本人が直すときの選択肢で共通に使う

export const OUTING_LABELS = [
  { value: "trip", label: "旅行" },
  { value: "homecoming", label: "帰省" },
  { value: "day_trip", label: "日帰り" },
  // 近場で遊ぶ・買い物・食事など。旅の一覧と友達への共有には入れない
  { value: "outing", label: "おでかけ" },
  { value: "daily", label: "日常" },
] as const;

export type OutingLabel = (typeof OUTING_LABELS)[number]["value"];

export const OUTING_LABEL_VALUES = OUTING_LABELS.map((l) => l.value) as [
  OutingLabel,
  ...OutingLabel[],
];

export function labelName(value: string | null): string {
  return OUTING_LABELS.find((l) => l.value === value)?.label ?? "未判定";
}

// 「旅の一覧」と友達への共有に入る種類（おでかけ・日常は入れない）
export const TRAVEL_LABELS: readonly OutingLabel[] = [
  "trip",
  "homecoming",
  "day_trip",
];
