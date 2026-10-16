// 新幹線の切符の表示に使う計算（デザインの選び方・時刻）

export const RAIL_DESIGNS = [
  { value: "mint", label: "ミントグリーン" },
  { value: "sky", label: "水色" },
  { value: "retro", label: "硬券風" },
  // 路線ごとの色（車体の帯の色をイメージ。会社のロゴやマークは使わない）
  { value: "tokaido", label: "東海道・山陽（白と青）" },
  { value: "tohoku", label: "東北（緑とピンク）" },
  { value: "hokkaido", label: "北海道（緑と紫）" },
  { value: "hokuriku", label: "北陸・上越（空色と銅）" },
  { value: "kyushu", label: "九州（赤と金）" },
  { value: "akita", label: "秋田（赤）" },
  { value: "yamagata", label: "山形（黄と紫）" },
] as const;

export type RailDesign = (typeof RAIL_DESIGNS)[number]["value"];

export const isRailDesign = (v: unknown): v is RailDesign =>
  RAIL_DESIGNS.some((d) => d.value === v);

// 本人が選んでいなければ、路線の色（路線名から決める。例：東北新幹線 → 東北）
export function defaultRailDesign(lineName: string): RailDesign {
  if (/北海道/.test(lineName)) return "hokkaido";
  if (/秋田/.test(lineName)) return "akita";
  if (/山形/.test(lineName)) return "yamagata";
  if (/東北/.test(lineName)) return "tohoku";
  if (/北陸|上越/.test(lineName)) return "hokuriku";
  if (/九州/.test(lineName)) return "kyushu";
  if (/東海道|山陽/.test(lineName)) return "tokaido";
  return "sky";
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
