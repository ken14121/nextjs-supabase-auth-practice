import countries from "i18n-iso-countries";
import ja from "i18n-iso-countries/langs/ja.json";

// 地域コード（JP-13 / US）を日本語の名前にする

countries.registerLocale(ja);

export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

export function isPrefectureCode(code: string): boolean {
  return /^JP-\d{2}$/.test(code);
}

export function regionName(code: string): string {
  if (isPrefectureCode(code)) {
    return PREFECTURES[Number(code.slice(3)) - 1] ?? code;
  }
  return countries.getName(code, "ja") ?? code;
}

export function prefectureCode(index: number): string {
  return `JP-${String(index + 1).padStart(2, "0")}`;
}

// 入力フォームで使う、地方ごとの都道府県（都道府県コードの範囲）
export const PREFECTURE_GROUPS = [
  { name: "北海道・東北", from: 1, to: 7 },
  { name: "関東", from: 8, to: 14 },
  { name: "中部", from: 15, to: 23 },
  { name: "近畿", from: 24, to: 30 },
  { name: "中国", from: 31, to: 35 },
  { name: "四国", from: 36, to: 39 },
  { name: "九州・沖縄", from: 40, to: 47 },
].map((group) => ({
  name: group.name,
  codes: Array.from({ length: group.to - group.from + 1 }, (_, i) =>
    prefectureCode(group.from - 1 + i),
  ),
}));

// 正式名称に含まれない、ふだん使う呼び方（検索用）
const COUNTRY_ALIASES: Record<string, string[]> = {
  KR: ["韓国"],
  KP: ["北朝鮮"],
  CN: ["中国"],
  US: ["アメリカ", "米国", "ハワイ"],
  GB: ["英国", "UK"],
  AE: ["UAE", "ドバイ"],
  TW: ["台湾"],
  HK: ["香港"],
  MO: ["マカオ"],
  RU: ["ロシア"],
  NZ: ["ニュージーランド"],
  VN: ["ベトナム"],
  CZ: ["チェコ"],
};

// 入力フォームで使う国の一覧（日本は都道府県で選ぶので除く）。日本語の名前順
export function countryOptions(): {
  code: string;
  name: string;
  keywords: string;
}[] {
  return Object.entries(countries.getNames("ja", { select: "official" }))
    .filter(([code]) => code !== "JP")
    .map(([code, name]) => ({
      code,
      name,
      keywords: [name, code, ...(COUNTRY_ALIASES[code] ?? [])]
        .join(" ")
        .toLowerCase(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}
