// 行った日数の段階と色。2D の地図と 3D の地球儀で同じものを使う
//（1 色（青）を薄い → 濃いで使う）

export type VisitedRegion = {
  region_code: string;
  first_visited_on: string;
  last_visited_on: string;
  visited_days: number;
};

export const BINS = [
  { min: 1, label: "1日", fill: "#86b6ef" },
  { min: 2, label: "2〜4日", fill: "#3987e5" },
  { min: 5, label: "5〜19日", fill: "#1c5cab" },
  { min: 20, label: "20日以上", fill: "#0d366b" },
] as const;

export const NOT_VISITED_FILL = "#e7e6e2";

export function fillFor(days: number | undefined): string {
  if (!days) return NOT_VISITED_FILL;
  let fill: string = BINS[0].fill;
  for (const bin of BINS) {
    if (days >= bin.min) fill = bin.fill;
  }
  return fill;
}
