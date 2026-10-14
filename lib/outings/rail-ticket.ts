// 新幹線の切符の表示に使う計算（デザインの選び方・時刻）

export const RAIL_DESIGNS = [
  { value: "mint", label: "ミントグリーン" },
  { value: "sky", label: "水色" },
  { value: "retro", label: "硬券風" },
] as const;

export type RailDesign = (typeof RAIL_DESIGNS)[number]["value"];

export const isRailDesign = (v: unknown): v is RailDesign =>
  RAIL_DESIGNS.some((d) => d.value === v);

// 本人が選んでいなければ、東日本（東北・北海道・秋田・山形・上越・北陸）はミント、ほかは水色
export function defaultRailDesign(lineName: string): RailDesign {
  return /東北|北海道|秋田|山形|上越|北陸/.test(lineName) ? "mint" : "sky";
}

// 「10月14日」「16:00」「2時間30分」（日本時間）
export function railDate(iso: string): string {
  const [y, m, d] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .split("-")
    .map(Number);
  return `${y}年${m}月${d}日`;
}

export function railTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rideDuration(departedAt: string, arrivedAt: string): string {
  const minutes = Math.round(
    (Date.parse(arrivedAt) - Date.parse(departedAt)) / 60_000,
  );
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}時間${minutes % 60}分` : `${minutes}分`;
}
