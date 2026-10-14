import airportData from "./data/airports.json";

// 空港の一覧（OurAirports、パブリックドメイン。作り方は scripts/build-airport-data.mjs）から、
// 緯度経度に一番近い空港を探す。飛行機の移動の始点・終点から、出発・到着の空港を決めるのに使う

type AirportRow = [
  iata: string,
  lat: number,
  lng: number,
  country: string,
  city: string,
];
const AIRPORTS = airportData as AirportRow[];

// 飛行機の移動の始点・終点がこれより遠いと、空港は「わからない」にする
const MAX_AIRPORT_KM = 60;

// 日本の空港は、搭乗券に日本語の名前を出す（無いものは英語の都市名）
const JA_NAMES: Record<string, string> = {
  HND: "東京（羽田）",
  NRT: "東京（成田）",
  KIX: "大阪（関西）",
  ITM: "大阪（伊丹）",
  UKB: "神戸",
  NGO: "名古屋（中部）",
  NKM: "名古屋（小牧）",
  CTS: "札幌（新千歳）",
  OKD: "札幌（丘珠）",
  HKD: "函館",
  AKJ: "旭川",
  KUH: "釧路",
  OBO: "帯広",
  MMB: "女満別",
  WKJ: "稚内",
  SHB: "中標津",
  MBE: "紋別",
  AOJ: "青森",
  MSJ: "三沢",
  HNA: "花巻",
  AXT: "秋田",
  ONJ: "大館能代",
  GAJ: "山形",
  SYO: "庄内",
  SDJ: "仙台",
  FKS: "福島",
  IBR: "茨城",
  KIJ: "新潟",
  TOY: "富山",
  KMQ: "小松",
  NTQ: "能登",
  MMJ: "松本",
  FSZ: "静岡",
  SHM: "南紀白浜",
  TJH: "但馬",
  OKJ: "岡山",
  HIJ: "広島",
  IZO: "出雲",
  YGJ: "米子",
  TTJ: "鳥取",
  IWJ: "石見",
  UBJ: "山口宇部",
  IWK: "岩国",
  TKS: "徳島",
  TAK: "高松",
  KCZ: "高知",
  MYJ: "松山",
  FUK: "福岡",
  KKJ: "北九州",
  HSG: "佐賀",
  NGS: "長崎",
  KMJ: "熊本",
  OIT: "大分",
  KMI: "宮崎",
  KOJ: "鹿児島",
  TNE: "種子島",
  KUM: "屋久島",
  ASJ: "奄美",
  OKA: "沖縄（那覇）",
  ISG: "石垣",
  MMY: "宮古",
  SHI: "下地島",
  OKE: "沖永良部",
  TKN: "徳之島",
  HAC: "八丈島",
  OIM: "大島",
  IKI: "壱岐",
  TSJ: "対馬",
  FUJ: "五島福江",
  ICN: "ソウル（仁川）",
  GMP: "ソウル（金浦）",
  PUS: "釜山",
  CJU: "済州",
  TPE: "台北（桃園）",
  TSA: "台北（松山）",
  KHH: "高雄",
  HKG: "香港",
  MFM: "マカオ",
  PEK: "北京",
  PKX: "北京（大興）",
  PVG: "上海（浦東）",
  SHA: "上海（虹橋）",
  BKK: "バンコク",
  DMK: "バンコク（ドンムアン）",
  SIN: "シンガポール",
  KUL: "クアラルンプール",
  MNL: "マニラ",
  CEB: "セブ",
  SGN: "ホーチミン",
  HAN: "ハノイ",
  DAD: "ダナン",
  DPS: "バリ",
  CGK: "ジャカルタ",
  GUM: "グアム",
  SPN: "サイパン",
  HNL: "ホノルル",
  LAX: "ロサンゼルス",
  SFO: "サンフランシスコ",
  SEA: "シアトル",
  JFK: "ニューヨーク",
  EWR: "ニューヨーク",
  ORD: "シカゴ",
  YVR: "バンクーバー",
  LHR: "ロンドン",
  CDG: "パリ",
  FRA: "フランクフルト",
  AMS: "アムステルダム",
  FCO: "ローマ",
  HEL: "ヘルシンキ",
  IST: "イスタンブール",
  DXB: "ドバイ",
  DOH: "ドーハ",
  SYD: "シドニー",
  MEL: "メルボルン",
  BNE: "ブリスベン",
  AKL: "オークランド",
};

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111.2;
}

// 例: 羽田空港の近く → "HND"。近くに空港が無い → null
export function nearestAirport(lat: number, lng: number): string | null {
  let best: { iata: string; km: number } | null = null;
  for (const [iata, aLat, aLng] of AIRPORTS) {
    if (Math.abs(aLat - lat) > 1 || Math.abs(aLng - lng) > 1.5) continue;
    const km = roughKm(lat, lng, aLat, aLng);
    if (km <= MAX_AIRPORT_KM && (!best || km < best.km)) best = { iata, km };
  }
  return best?.iata ?? null;
}

export type AirportLabel = { code: string; city: string; country: string };

// "KMJ" → { code: "KMJ", city: "熊本", country: "JP" }
export function airportLabel(iata: string | null): AirportLabel {
  if (!iata) return { code: "???", city: "不明", country: "" };
  const row = AIRPORTS.find((a) => a[0] === iata);
  return {
    code: iata,
    city: JA_NAMES[iata] ?? row?.[4] ?? iata,
    country: row?.[3] ?? "",
  };
}
