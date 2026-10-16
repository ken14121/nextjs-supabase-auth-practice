// 搭乗券のバーコード（IATA の BCBP 形式。紙の PDF417 も、スマホの QR・Aztec も中身は同じ）を読む。
//
// バーコードには名前と予約番号（PNR）も入っているが、予約番号は名前と組み合わせると
// 予約の変更・キャンセルができてしまうことがある。そのため、ここでは読み飛ばして返さない。
// 返すのは、空港・航空会社・便名・日付（年の何日目か）・座席だけ。
//
// 決まった位置の項目（Resolution 792 の「必須項目」）:
//   0     形式 "M"            1     区間の数
//   2-21  名前（20 文字）      22    電子チケットの印
//   ここから 1 区間ぶん（37 文字）:
//   予約番号 7・出発 3・到着 3・航空会社 3・便名 5・日付 3・クラス 1・座席 4・搭乗順 5・状態 1・続く項目の長さ 2（16 進）

export type BoardingPassLeg = {
  from: string;
  to: string;
  // 航空会社の 2〜3 文字のコード（例: JL、NH、MM）
  airline: string;
  // 便名の数字（先頭の 0 は取る。例: "0631" → "631"）
  flightNumber: string;
  // 年の何日目か（1〜366）。年はバーコードに入っていない
  dayOfYear: number;
  // 座席（先頭の 0 は取る。例: "012A" → "12A"）。座席が決まっていなければ null
  seat: string | null;
};

const LEG_LENGTH = 37;

export class BoardingPassFormatError extends Error {}

export function parseBoardingPass(text: string): BoardingPassLeg[] {
  if (text[0] !== "M" || !/^[1-4]$/.test(text[1] ?? "")) {
    throw new BoardingPassFormatError(
      "搭乗券のバーコードではないようです（IATA の形式ではありません）",
    );
  }
  const legCount = Number(text[1]);
  const legs: BoardingPassLeg[] = [];
  let pos = 23;
  for (let i = 0; i < legCount; i++) {
    const leg = text.slice(pos, pos + LEG_LENGTH);
    if (leg.length < LEG_LENGTH) {
      throw new BoardingPassFormatError(
        "搭乗券のバーコードが途中で切れています",
      );
    }
    // leg.slice(0, 7) は予約番号。読まずに飛ばす
    const from = leg.slice(7, 10).trim();
    const to = leg.slice(10, 13).trim();
    const airline = leg.slice(13, 16).trim();
    const flightNumber = leg
      .slice(16, 21)
      .trim()
      .replace(/^0+(?=\d)/, "");
    const dayOfYear = Number(leg.slice(21, 24));
    const seatRaw = leg
      .slice(25, 29)
      .trim()
      .replace(/^0+(?=\d)/, "");
    const variableSize = Number.parseInt(leg.slice(35, 37), 16);
    if (
      !/^[A-Z]{3}$/.test(from) ||
      !/^[A-Z]{3}$/.test(to) ||
      !/^[A-Z0-9]{2,3}$/.test(airline) ||
      !/^\d{1,4}[A-Z]?$/.test(flightNumber) ||
      !(dayOfYear >= 1 && dayOfYear <= 366) ||
      Number.isNaN(variableSize)
    ) {
      throw new BoardingPassFormatError(
        "搭乗券のバーコードを読み取れませんでした",
      );
    }
    legs.push({
      from,
      to,
      airline,
      flightNumber,
      dayOfYear,
      seat: /^\d{1,3}[A-Z]$/.test(seatRaw) ? seatRaw : null,
    });
    pos += LEG_LENGTH + variableSize;
  }
  return legs;
}

// 日本時間の日付が、年の何日目か（搭乗券の日付と、タイムラインの便を照らし合わせるのに使う）
export function jstDayOfYear(iso: string): number {
  const [y, m, d] = new Date(iso)
    .toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
    .split("-")
    .map(Number);
  return (
    Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1
  );
}

// 搭乗券の区間が、タイムラインの便と同じか（空港が同じで、日付が前後 1 日以内）。
// 時差で日付がずれることがあるので 1 日の幅を持たせる
export function matchesFlight(
  leg: BoardingPassLeg,
  flight: { from: string | null; to: string | null; departedAt: string },
): boolean {
  const day = jstDayOfYear(flight.departedAt);
  const diff = Math.abs(day - leg.dayOfYear);
  return (
    leg.from === flight.from &&
    leg.to === flight.to &&
    (diff <= 1 || diff >= 364)
  );
}

// 主な航空会社の名前（航空会社のロゴなどは使わず、名前の文字だけ出す）
const AIRLINE_NAMES: Record<string, string> = {
  JL: "日本航空",
  NH: "全日空",
  MM: "ピーチ",
  GK: "ジェットスター",
  BC: "スカイマーク",
  "7G": "スターフライヤー",
  IJ: "スプリング・ジャパン",
  ZG: "ZIPAIR",
  HD: "エア・ドゥ",
  "6J": "ソラシドエア",
  FW: "フジドリームエアラインズ",
  NU: "日本トランスオーシャン航空",
  KE: "大韓航空",
  OZ: "アシアナ航空",
  "7C": "チェジュ航空",
  LJ: "ジンエアー",
  TW: "ティーウェイ航空",
  CI: "チャイナエアライン",
  BR: "エバー航空",
  IT: "タイガーエア台湾",
  CX: "キャセイパシフィック",
  SQ: "シンガポール航空",
  TG: "タイ国際航空",
  UA: "ユナイテッド航空",
  AA: "アメリカン航空",
  DL: "デルタ航空",
  HA: "ハワイアン航空",
  AF: "エールフランス",
  LH: "ルフトハンザ",
  BA: "ブリティッシュ・エアウェイズ",
  AY: "フィンエアー",
  EK: "エミレーツ航空",
  QR: "カタール航空",
  TR: "スクート",
  VJ: "ベトジェット",
  "5J": "セブパシフィック",
};

export function airlineName(code: string | null): string | null {
  if (!code) return null;
  return AIRLINE_NAMES[code] ?? code;
}
