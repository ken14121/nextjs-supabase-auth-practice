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
