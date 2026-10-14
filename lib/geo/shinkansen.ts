// 新幹線の駅の一覧（駅の位置は、だいたいの緯度経度。新幹線の乗り降りした駅を決めるのに使う）。
// 駅の位置は事実の情報なので、手で書いた。路線は、その駅に止まる新幹線（直通する路線も含む）

export type ShinkansenLine =
  | "tokaido"
  | "sanyo"
  | "kyushu"
  | "nishikyushu"
  | "tohoku"
  | "hokkaido"
  | "akita"
  | "yamagata"
  | "joetsu"
  | "hokuriku";

export const LINE_NAMES: Record<ShinkansenLine, string> = {
  tokaido: "東海道",
  sanyo: "山陽",
  kyushu: "九州",
  nishikyushu: "西九州",
  tohoku: "東北",
  hokkaido: "北海道",
  akita: "秋田",
  yamagata: "山形",
  joetsu: "上越",
  hokuriku: "北陸",
};

type Station = [
  id: string,
  name: string,
  lat: number,
  lng: number,
  lines: ShinkansenLine[],
];

const T: ShinkansenLine[] = ["tokaido"];
const S: ShinkansenLine[] = ["sanyo"];
const K: ShinkansenLine[] = ["kyushu"];
const NK: ShinkansenLine[] = ["nishikyushu"];
const TH: ShinkansenLine[] = ["tohoku"];
const HK: ShinkansenLine[] = ["hokkaido"];
const AK: ShinkansenLine[] = ["akita"];
const YM: ShinkansenLine[] = ["yamagata"];
const JE: ShinkansenLine[] = ["joetsu"];
const HR: ShinkansenLine[] = ["hokuriku"];

export const STATIONS: Station[] = [
  // 東京から出る路線がまとまる駅
  [
    "tokyo",
    "東京",
    35.6812,
    139.7671,
    [
      "tokaido",
      "tohoku",
      "joetsu",
      "hokuriku",
      "akita",
      "yamagata",
      "hokkaido",
    ],
  ],
  [
    "ueno",
    "上野",
    35.7138,
    139.7773,
    ["tohoku", "joetsu", "hokuriku", "akita", "yamagata", "hokkaido"],
  ],
  [
    "omiya",
    "大宮",
    35.9063,
    139.6239,
    ["tohoku", "joetsu", "hokuriku", "akita", "yamagata", "hokkaido"],
  ],
  // 東海道
  ["shinagawa", "品川", 35.6285, 139.7387, T],
  ["shin-yokohama", "新横浜", 35.5075, 139.6175, T],
  ["odawara", "小田原", 35.2564, 139.1552, T],
  ["atami", "熱海", 35.1037, 139.0777, T],
  ["mishima", "三島", 35.1265, 138.9109, T],
  ["shin-fuji", "新富士", 35.1424, 138.6634, T],
  ["shizuoka", "静岡", 34.9716, 138.389, T],
  ["kakegawa", "掛川", 34.7692, 138.0146, T],
  ["hamamatsu", "浜松", 34.7038, 137.7349, T],
  ["toyohashi", "豊橋", 34.7629, 137.3815, T],
  ["mikawa-anjo", "三河安城", 34.9686, 137.0602, T],
  ["nagoya", "名古屋", 35.1709, 136.8815, T],
  ["gifu-hashima", "岐阜羽島", 35.3157, 136.6859, T],
  ["maibara", "米原", 35.3146, 136.2899, T],
  ["kyoto", "京都", 34.9858, 135.7588, T],
  ["shin-osaka", "新大阪", 34.7334, 135.5001, ["tokaido", "sanyo"]],
  // 山陽
  ["shin-kobe", "新神戸", 34.7069, 135.1953, S],
  ["nishi-akashi", "西明石", 34.6642, 134.9612, S],
  ["himeji", "姫路", 34.8268, 134.6906, S],
  ["aioi", "相生", 34.8073, 134.4693, S],
  ["okayama", "岡山", 34.6661, 133.9177, S],
  ["shin-kurashiki", "新倉敷", 34.5967, 133.6819, S],
  ["fukuyama", "福山", 34.4893, 133.3622, S],
  ["shin-onomichi", "新尾道", 34.4307, 133.1726, S],
  ["mihara", "三原", 34.4004, 133.0816, S],
  ["higashi-hiroshima", "東広島", 34.4196, 132.7713, S],
  ["hiroshima", "広島", 34.3976, 132.4751, S],
  ["shin-iwakuni", "新岩国", 34.1634, 132.164, S],
  ["tokuyama", "徳山", 34.0523, 131.8066, S],
  ["shin-yamaguchi", "新山口", 34.0934, 131.3965, S],
  ["asa", "厚狭", 34.0499, 131.1633, S],
  ["shin-shimonoseki", "新下関", 34.0158, 130.9473, S],
  ["kokura", "小倉", 33.8868, 130.8824, S],
  ["hakata", "博多", 33.5897, 130.4207, ["sanyo", "kyushu"]],
  // 九州
  ["shin-tosu", "新鳥栖", 33.3786, 130.4979, K],
  ["kurume", "久留米", 33.3199, 130.5167, K],
  ["chikugo-funagoya", "筑後船小屋", 33.2178, 130.481, K],
  ["shin-omuta", "新大牟田", 33.0641, 130.4757, K],
  ["shin-tamana", "新玉名", 32.9348, 130.5798, K],
  ["kumamoto", "熊本", 32.7898, 130.6888, K],
  ["shin-yatsushiro", "新八代", 32.5282, 130.6206, K],
  ["shin-minamata", "新水俣", 32.214, 130.4142, K],
  ["izumi", "出水", 32.0783, 130.3537, K],
  ["sendai-kyushu", "川内", 31.8144, 130.3173, K],
  ["kagoshima-chuo", "鹿児島中央", 31.5838, 130.5413, K],
  // 西九州
  ["takeo-onsen", "武雄温泉", 33.1933, 130.0201, NK],
  ["ureshino-onsen", "嬉野温泉", 33.1014, 129.9959, NK],
  ["shin-omura", "新大村", 32.9272, 129.9638, NK],
  ["isahaya", "諫早", 32.8449, 130.0501, NK],
  ["nagasaki", "長崎", 32.7522, 129.8693, NK],
  // 東北
  ["oyama", "小山", 36.3129, 139.8061, TH],
  ["utsunomiya", "宇都宮", 36.559, 139.8984, TH],
  ["nasushiobara", "那須塩原", 36.9316, 140.0209, TH],
  ["shin-shirakawa", "新白河", 37.1231, 140.1878, TH],
  ["koriyama", "郡山", 37.3982, 140.3884, TH],
  ["fukushima", "福島", 37.7543, 140.4592, ["tohoku", "yamagata"]],
  ["shiroishi-zao", "白石蔵王", 37.9852, 140.6378, TH],
  ["sendai", "仙台", 38.2601, 140.8822, TH],
  ["furukawa", "古川", 38.5704, 140.9677, TH],
  ["kurikoma-kogen", "くりこま高原", 38.7487, 141.0713, TH],
  ["ichinoseki", "一ノ関", 38.9263, 141.1368, TH],
  ["mizusawa-esashi", "水沢江刺", 39.144, 141.1877, TH],
  ["kitakami", "北上", 39.2866, 141.115, TH],
  ["shin-hanamaki", "新花巻", 39.4052, 141.1701, TH],
  ["morioka", "盛岡", 39.7015, 141.1365, ["tohoku", "akita"]],
  ["iwate-numakunai", "いわて沼宮内", 39.9549, 141.2138, TH],
  ["ninohe", "二戸", 40.2642, 141.3004, TH],
  ["hachinohe", "八戸", 40.5094, 141.4312, TH],
  ["shichinohe-towada", "七戸十和田", 40.716, 141.1529, TH],
  ["shin-aomori", "新青森", 40.827, 140.6935, ["tohoku", "hokkaido"]],
  // 北海道
  ["okutsugaru-imabetsu", "奥津軽いまべつ", 41.145, 140.515, HK],
  ["kikonai", "木古内", 41.6779, 140.4322, HK],
  ["shin-hakodate-hokuto", "新函館北斗", 41.9049, 140.6487, HK],
  // 秋田（ミニ新幹線）
  ["shizukuishi", "雫石", 39.6962, 140.976, AK],
  ["tazawako", "田沢湖", 39.7004, 140.7187, AK],
  ["kakunodate", "角館", 39.5943, 140.5672, AK],
  ["omagari", "大曲", 39.4541, 140.4761, AK],
  ["akita", "秋田", 39.7173, 140.1293, AK],
  // 山形（ミニ新幹線）
  ["yonezawa", "米沢", 37.9081, 140.13, YM],
  ["takahata", "高畠", 37.9998, 140.1855, YM],
  ["akayu", "赤湯", 38.0494, 140.1519, YM],
  ["kaminoyama-onsen", "かみのやま温泉", 38.1551, 140.278, YM],
  ["yamagata", "山形", 38.2487, 140.3279, YM],
  ["tendo", "天童", 38.3561, 140.3764, YM],
  ["sakurambo-higashine", "さくらんぼ東根", 38.4307, 140.3976, YM],
  ["murayama", "村山", 38.4858, 140.3833, YM],
  ["oishida", "大石田", 38.592, 140.3732, YM],
  ["shinjo", "新庄", 38.7626, 140.304, YM],
  // 上越
  ["kumagaya", "熊谷", 36.1393, 139.39, ["joetsu", "hokuriku"]],
  ["honjo-waseda", "本庄早稲田", 36.2183, 139.1802, ["joetsu", "hokuriku"]],
  ["takasaki", "高崎", 36.3222, 139.0127, ["joetsu", "hokuriku"]],
  ["jomo-kogen", "上毛高原", 36.6817, 138.979, JE],
  ["echigo-yuzawa", "越後湯沢", 36.9358, 138.8098, JE],
  ["urasa", "浦佐", 37.17, 138.9209, JE],
  ["nagaoka", "長岡", 37.4474, 138.8514, JE],
  ["tsubame-sanjo", "燕三条", 37.6603, 138.9592, JE],
  ["niigata", "新潟", 37.9122, 139.0613, JE],
  // 北陸
  ["annaka-haruna", "安中榛名", 36.3634, 138.849, HR],
  ["karuizawa", "軽井沢", 36.3428, 138.6352, HR],
  ["sakudaira", "佐久平", 36.2777, 138.4641, HR],
  ["ueda", "上田", 36.3976, 138.2496, HR],
  ["nagano", "長野", 36.6431, 138.1886, HR],
  ["iiyama", "飯山", 36.8444, 138.3597, HR],
  ["joetsumyoko", "上越妙高", 37.0611, 138.2489, HR],
  ["itoigawa", "糸魚川", 37.043, 137.8616, HR],
  ["kurobe-unazukionsen", "黒部宇奈月温泉", 36.8732, 137.4802, HR],
  ["toyama", "富山", 36.7013, 137.2133, HR],
  ["shin-takaoka", "新高岡", 36.7308, 137.0111, HR],
  ["kanazawa", "金沢", 36.5781, 136.648, HR],
  ["komatsu", "小松", 36.4034, 136.4533, HR],
  ["kagaonsen", "加賀温泉", 36.3175, 136.3544, HR],
  ["awaraonsen", "芦原温泉", 36.2183, 136.2348, HR],
  ["fukui", "福井", 36.0621, 136.2232, HR],
  ["echizen-takefu", "越前たけふ", 35.8811, 136.1887, HR],
  ["tsuruga", "敦賀", 35.6453, 136.0757, HR],
];

const byId = new Map(STATIONS.map((s) => [s[0], s]));

// 乗り降りした場所がこれより遠いと、新幹線の駅ではないとみなす
const MAX_STATION_KM = 3;

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111.2;
}

// 例: 東京駅の近く → "tokyo"。近くに新幹線の駅が無い → null
export function nearestShinkansenStation(
  lat: number,
  lng: number,
): string | null {
  let best: { id: string; km: number } | null = null;
  for (const [id, , sLat, sLng] of STATIONS) {
    const km = roughKm(lat, lng, sLat, sLng);
    if (km <= MAX_STATION_KM && (!best || km < best.km)) best = { id, km };
  }
  return best?.id ?? null;
}

export function stationName(id: string): string {
  return byId.get(id)?.[1] ?? id;
}

// 2 つの駅を通る路線の名前。例: 東京 → 新大阪「東海道新幹線」、東京 → 博多「東海道・山陽新幹線」
export function lineNameBetween(fromId: string, toId: string): string {
  const from = byId.get(fromId)?.[4] ?? [];
  const to = byId.get(toId)?.[4] ?? [];
  const common = from.filter((l) => to.includes(l));
  if (common.length > 0) return `${LINE_NAMES[common[0]]}新幹線`;
  const names = [from[0], to[0]].filter(Boolean).map((l) => LINE_NAMES[l]);
  return `${[...new Set(names)].join("・")}新幹線`;
}
