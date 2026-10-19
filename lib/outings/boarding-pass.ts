// 搭乗券の表示に使う計算（デザインの選び方・時刻・飾りのバーコード）

export const PASS_DESIGNS = [
  { value: "classic", label: "クラシック（赤）" },
  { value: "mono", label: "モノクロ" },
  { value: "sand", label: "ベージュ" },
  { value: "noir", label: "黒と金" },
] as const;

export type PassDesign = (typeof PASS_DESIGNS)[number]["value"];

export const isPassDesign = (v: unknown): v is PassDesign =>
  PASS_DESIGNS.some((d) => d.value === v);

// 本人が選んでいなければ、国内線はクラシック、国際線は黒と金、空港がわからなければモノクロ
export function defaultDesign(
  fromCountry: string,
  toCountry: string,
): PassDesign {
  if (!fromCountry || !toCountry) return "mono";
  return fromCountry === "JP" && toCountry === "JP" ? "classic" : "noir";
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

// 日本時間の「10 SEP 2026」と「09:05」
export function passDate(iso: string): string {
  const [y, m, d] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .split("-")
    .map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function passTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 飛行時間「1h55m」
export function flightDuration(departedAt: string, arrivedAt: string): string {
  const minutes = Math.round(
    (Date.parse(arrivedAt) - Date.parse(departedAt)) / 60_000,
  );
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

// 飾りのバーコード（本物のバーコードではない）。便の id から決まる、毎回同じ太さの並び
export function decorativeBars(seed: string, count = 36): number[] {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    bars.push(1 + ((h >>> 0) % 3));
  }
  return bars;
}
