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
