// 行った日数の段階と色。2D の地図と 3D の地球儀で同じものを使う
//（地図帳の差し色の朱を、薄い → 濃いで使う。docs/design/DECISIONS.md の 2-4）

export type VisitedRegion = {
  region_code: string;
  first_visited_on: string;
  last_visited_on: string;
  visited_days: number;
};

export const BINS = [
  { min: 1, label: "1日", fill: "#efc3b6" },
  { min: 2, label: "2〜4日", fill: "#df8e78" },
  { min: 5, label: "5〜19日", fill: "#c8432c" },
  { min: 20, label: "20日以上", fill: "#8f2716" },
] as const;

// 行っていない場所は、紙より少し濃い色
export const NOT_VISITED_FILL = "#e4ddcf";

export function fillFor(days: number | undefined): string {
  if (!days) return NOT_VISITED_FILL;
  let fill: string = BINS[0].fill;
  for (const bin of BINS) {
    if (days >= bin.min) fill = bin.fill;
  }
  return fill;
}
