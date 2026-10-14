import { expect, test } from "@playwright/test";
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  EncodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  QRCodeWriter,
  RGBLuminanceSource,
} from "@zxing/library";
import {
  airlineName,
  BoardingPassFormatError,
  jstDayOfYear,
  matchesFlight,
  parseBoardingPass,
} from "@/lib/outings/bcbp";

// 架空の搭乗券のバーコードの中身（IATA の BCBP 形式）を組み立てる
function leg(
  pnr: string,
  from: string,
  to: string,
  airline: string,
  flight: string,
  day: string,
  seat: string,
  variable = "",
) {
  const size = variable.length.toString(16).toUpperCase().padStart(2, "0");
  return `${pnr.padEnd(7)}${from}${to}${airline.padEnd(3)}${flight.padEnd(5)}${day}Y${seat}0012 1${size}${variable}`;
}
const pass = (name: string, ...legs: string[]) =>
  `M${legs.length}${name.padEnd(20)}E${legs.join("")}`;

test("搭乗券のバーコードから、空港・航空会社・便名・日付・座席を読む", () => {
  const text = pass(
    "YAMADA/TARO",
    leg("ABC123", "HND", "KMJ", "JL", "0631", "253", "012A", ">5180"),
  );
  expect(parseBoardingPass(text)).toEqual([
    {
      from: "HND",
      to: "KMJ",
      airline: "JL",
      flightNumber: "631",
      dayOfYear: 253,
      seat: "12A",
    },
  ]);
});

test("名前と予約番号は、返す値のどこにも入らない", () => {
  const text = pass(
    "YAMADA/TARO",
    leg("XYZ789", "NRT", "ICN", "KE", "0704", "122", "033K"),
  );
  const json = JSON.stringify(parseBoardingPass(text));
  expect(json).not.toContain("YAMADA");
  expect(json).not.toContain("XYZ789");
});

test("乗り継ぎの 2 区間を読む。座席が決まっていなければ null", () => {
  const text = pass(
    "SATO/HANAKO",
    leg("PNR001", "KIX", "HND", "NH", "0016", "300", "000 ", ">5180"),
    leg("PNR001", "HND", "CTS", "NH", "0059", "300", "021C"),
  );
  const legs = parseBoardingPass(text);
  expect(
    legs.map((l) => `${l.from}-${l.to} ${l.airline}${l.flightNumber}`),
  ).toEqual(["KIX-HND NH16", "HND-CTS NH59"]);
  expect(legs[0].seat).toBeNull();
  expect(legs[1].seat).toBe("21C");
});

test("搭乗券ではないものは、わかりやすいエラーにする", () => {
  expect(() => parseBoardingPass("https://example.com")).toThrow(
    BoardingPassFormatError,
  );
  expect(() => parseBoardingPass("M1SHORT")).toThrow(BoardingPassFormatError);
});

test("搭乗券の区間とタイムラインの便を、空港と日付（前後 1 日）で照らし合わせる", () => {
  expect(jstDayOfYear("2026-09-10T00:05:00Z")).toBe(253);
  const l = parseBoardingPass(
    pass("A/B", leg("P", "HND", "KMJ", "JL", "0631", "253", "012A")),
  )[0];
  expect(
    matchesFlight(l, {
      from: "HND",
      to: "KMJ",
      departedAt: "2026-09-10T00:05:00Z",
    }),
  ).toBe(true);
  expect(
    matchesFlight(l, {
      from: "HND",
      to: "KMJ",
      departedAt: "2026-09-14T00:05:00Z",
    }),
  ).toBe(false);
  expect(
    matchesFlight(l, {
      from: "KMJ",
      to: "HND",
      departedAt: "2026-09-10T00:05:00Z",
    }),
  ).toBe(false);
  expect(airlineName("JL")).toBe("日本航空");
  expect(airlineName("ZZ")).toBe("ZZ");
});

test("スマホの搭乗券の QR コードにしても、そのまま読み戻せる（空白も崩れない）", () => {
  const text = pass(
    "YAMADA/TARO",
    leg("ABC123", "HND", "KMJ", "JL", "0631", "253", "012A", ">5180"),
  );
  const hints = new Map();
  hints.set(EncodeHintType.CHARACTER_SET, "ISO-8859-1");
  const matrix = new QRCodeWriter().encode(
    text,
    BarcodeFormat.QR_CODE,
    200,
    200,
    hints,
  );
  // 白黒の画像（白 = 255、黒 = 0）にしてから読む
  const pixels = new Uint8ClampedArray(matrix.getWidth() * matrix.getHeight());
  for (let y = 0; y < matrix.getHeight(); y++) {
    for (let x = 0; x < matrix.getWidth(); x++) {
      pixels[y * matrix.getWidth() + x] = matrix.get(x, y) ? 0 : 255;
    }
  }
  const source = new RGBLuminanceSource(
    pixels,
    matrix.getWidth(),
    matrix.getHeight(),
  );
  const readHints = new Map();
  readHints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
  ]);
  const result = new MultiFormatReader().decode(
    new BinaryBitmap(new HybridBinarizer(source)),
    readHints,
  );
  expect(result.getText()).toBe(text);
  expect(parseBoardingPass(result.getText())[0].flightNumber).toBe("631");
});
