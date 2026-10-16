import { PASS_DESIGNS, type PassDesign } from "./boarding-pass";
import { RAIL_DESIGNS, type RailDesign } from "./rail-ticket";

// 旅の索引を「切符」にするための判定。
//   ・切符の種類：主な移動手段と、自宅から一番遠い地点までの距離から、だいたいで決める
//     （電車で 100km 以上離れたら新幹線・特急とみなす。正確な列車まではわからない）
//   ・行き先：住んでいる都道府県以外で、一番長く（多くの日に）いた都道府県・国

export type TicketKind = {
  key: "flight" | "express" | "train" | "car" | "bus" | "boat" | "journey";
  name: string;
  latin: string;
};

const KINDS: Record<TicketKind["key"], TicketKind> = {
  flight: { key: "flight", name: "航空券", latin: "BOARDING PASS" },
  express: { key: "express", name: "新幹線・特急券", latin: "LIMITED EXPRESS" },
  train: { key: "train", name: "乗車券", latin: "TRAIN TICKET" },
  car: { key: "car", name: "ドライブ", latin: "DRIVE" },
  bus: { key: "bus", name: "バス乗車券", latin: "BUS TICKET" },
  boat: { key: "boat", name: "乗船券", latin: "FERRY TICKET" },
  journey: { key: "journey", name: "旅の切符", latin: "JOURNEY" },
};

// 種類の一覧（本人が選び直すときの選択肢）
export const TICKET_KINDS = Object.values(KINDS);

export const isTicketKindKey = (v: unknown): v is TicketKind["key"] =>
  typeof v === "string" && Object.hasOwn(KINDS, v);

export const kindByKey = (key: TicketKind["key"]): TicketKind => KINDS[key];

// 飛行機・新幹線の記録が無い旅の切符のデザイン。旅の切符の形 5 つに加えて、
// 搭乗券（pass-）・新幹線の切符（rail-）の形も選べる
const CARD_DESIGNS = [
  { value: "atlas", label: "切符：地図帳" },
  { value: "mint", label: "切符：ミントグリーン" },
  { value: "sky", label: "切符：水色" },
  { value: "retro", label: "切符：硬券風" },
  { value: "noir", label: "切符：黒と金" },
] as const;

export const TRIP_DESIGNS = [
  ...CARD_DESIGNS,
  ...PASS_DESIGNS.map((d) => ({
    value: `pass-${d.value}` as const,
    label: `搭乗券：${d.label}`,
  })),
  ...RAIL_DESIGNS.map((d) => ({
    value: `rail-${d.value}` as const,
    label: `新幹線：${d.label}`,
  })),
];

export type CardDesign = (typeof CARD_DESIGNS)[number]["value"];
export type TripDesign =
  | CardDesign
  | `pass-${PassDesign}`
  | `rail-${RailDesign}`;

export const isTripDesign = (v: unknown): v is TripDesign =>
  TRIP_DESIGNS.some((d) => d.value === v);

// どの形で描くか
export type TripLook =
  | { shape: "card"; design: CardDesign }
  | { shape: "pass"; design: PassDesign }
  | { shape: "rail"; design: RailDesign };

export function tripLook(design: TripDesign): TripLook {
  if (design.startsWith("pass-")) {
    return { shape: "pass", design: design.slice(5) as PassDesign };
  }
  if (design.startsWith("rail-")) {
    return { shape: "rail", design: design.slice(5) as RailDesign };
  }
  return { shape: "card", design: design as CardDesign };
}

// 電車でこれより遠くへ行ったら、新幹線・特急とみなす
export const EXPRESS_KM = 100;

export function ticketKind(
  mainTransport: string | null,
  maxKmFromHome: number | null,
): TicketKind {
  switch (mainTransport) {
    case "flight":
      return KINDS.flight;
    case "train":
      return maxKmFromHome !== null && maxKmFromHome >= EXPRESS_KM
        ? KINDS.express
        : KINDS.train;
    case "car":
      return KINDS.car;
    case "bus":
      return KINDS.bus;
    case "boat":
      return KINDS.boat;
    default:
      return KINDS.journey;
  }
}

// 行き先と経由地。regions は外出で行った県・国と日付（visited_regions の行）
export function destinationOf(
  regions: { region_code: string; visited_on: string }[],
  homeRegion: string | null,
): { destination: string | null; via: string[] } {
  const days = new Map<string, Set<string>>();
  const order: string[] = [];
  for (const r of regions) {
    if (!days.has(r.region_code)) {
      days.set(r.region_code, new Set());
      order.push(r.region_code);
    }
    days.get(r.region_code)?.add(r.visited_on);
  }
  const away = order.filter((code) => code !== homeRegion);
  if (away.length === 0) return { destination: null, via: [] };
  // 一番多くの日にいた場所。同じ日数なら、あとに行った方（旅の終わりの方が目的地のことが多い）
  let destination = away[0];
  for (const code of away) {
    if ((days.get(code)?.size ?? 0) >= (days.get(destination)?.size ?? 0)) {
      destination = code;
    }
  }
  return { destination, via: away.filter((code) => code !== destination) };
}

// 行った県・国を、訪れた順に並べる（住んでいる県は除く。同じ日なら記録の順）。
// 例：修学旅行 → 広島・愛媛・香川・徳島・兵庫
export function routeOf(
  regions: { region_code: string; visited_on: string }[],
  homeRegion: string | null,
): string[] {
  const first = new Map<string, string>();
  for (const r of regions) {
    if (r.region_code === homeRegion) continue;
    const seen = first.get(r.region_code);
    if (!seen || r.visited_on < seen) first.set(r.region_code, r.visited_on);
  }
  return [...first.entries()]
    .map(([code, on], i) => ({ code, on, i }))
    .sort((a, b) => a.on.localeCompare(b.on) || a.i - b.i)
    .map((r) => r.code);
}
