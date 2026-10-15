import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  airportDistanceKm,
  airportLabel,
  findAirport,
  isKnownAirport,
  nearestAirport,
} from "@/lib/geo/airports";
import {
  decorativeBars,
  defaultDesign,
  flightDuration,
  passDate,
  passTime,
} from "@/lib/outings/boarding-pass";
import { extractFlights } from "@/lib/timeline/flights";
import {
  extractSegments,
  type TimelineSegment,
  type TransportMode,
} from "@/lib/timeline/parse";

test("一番近い空港：羽田・熊本・仁川。遠すぎると null", () => {
  expect(nearestAirport(35.55, 139.78)).toBe("HND");
  expect(nearestAirport(32.84, 130.86)).toBe("KMJ");
  expect(nearestAirport(37.46, 126.44)).toBe("ICN");
  expect(nearestAirport(30.0, 140.0)).toBeNull(); // 太平洋の上
  expect(airportLabel("KMJ")).toEqual({
    code: "KMJ",
    city: "熊本",
    country: "JP",
  });
  expect(airportLabel(null).code).toBe("???");
});

test("飛行機の移動だけを便にする。短すぎる「飛行機」は誤判定として除く", () => {
  const flights = extractFlights(
    [
      {
        kind: "activity",
        start: "2026-09-10T00:05:00Z",
        end: "2026-09-10T02:00:00Z",
        from: { lat: 35.55, lng: 139.78 },
        to: { lat: 32.84, lng: 130.86 },
        distanceMeters: 0,
        mode: "flight",
      },
      {
        kind: "activity",
        start: "2026-09-11T00:00:00Z",
        end: "2026-09-11T00:20:00Z",
        from: { lat: 35.55, lng: 139.78 },
        to: { lat: 35.6, lng: 139.8 },
        distanceMeters: 8000,
        mode: "flight",
      },
      {
        kind: "activity",
        start: "2026-09-12T00:00:00Z",
        end: "2026-09-12T03:00:00Z",
        from: { lat: 35.68, lng: 139.77 },
        to: { lat: 34.7, lng: 135.5 },
        distanceMeters: 500000,
        mode: "train",
      },
    ],
    findAirport,
  );
  expect(flights).toHaveLength(1);
  expect(flights[0]).toMatchObject({ from: "HND", to: "KMJ" });
  // 記録に距離が無くても、直線距離で埋める
  expect(flights[0].distanceKm).toBeGreaterThan(800);
});

test("サンプルのタイムラインの飛行機は、伊丹・関西から北海道・沖縄・韓国へ", () => {
  const json = JSON.parse(
    readFileSync("docs/samples/sample-timeline-osaka.json", "utf8"),
  );
  const flights = extractFlights(extractSegments(json).segments, findAirport);
  expect(flights.map((f) => `${f.from}-${f.to}`)).toEqual([
    "ITM-CTS",
    "CTS-ITM",
    "KIX-ICN",
    "ICN-KIX",
    "KIX-OKA",
    "OKA-KIX",
  ]);
  // 空港コードと時刻と距離だけで、座標は持たない
  for (const f of flights) {
    expect(Object.keys(f).sort()).toEqual([
      "arrivedAt",
      "departedAt",
      "distanceKm",
      "from",
      "to",
    ]);
  }
});

// テスト用の場所
const HND = { lat: 35.553, lng: 139.781 };
const CTS = { lat: 42.775, lng: 141.692 };
const NGS = { lat: 32.917, lng: 129.914 };
const KOJ = { lat: 31.803, lng: 130.719 };
const OVER_IWATE = { lat: 39.5, lng: 141.2 }; // 花巻空港の近くの上空
const TOKYO_HOTEL = { lat: 35.68, lng: 139.77 };

const visit = (
  start: string,
  end: string,
  location: { lat: number; lng: number },
): TimelineSegment => ({ kind: "visit", start, end, location, isHome: false });

const move = (
  start: string,
  end: string,
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TransportMode,
): TimelineSegment => ({
  kind: "activity",
  start,
  end,
  from,
  to,
  distanceMeters: 0,
  mode,
});

test("飛び立ってから記録が始まった便は、直前にいた空港から出発にする", () => {
  const flights = extractFlights(
    [
      visit("2026-02-26T00:00:00Z", "2026-02-26T01:00:00Z", HND),
      move(
        "2026-02-26T01:24:00Z",
        "2026-02-26T02:25:00Z",
        OVER_IWATE,
        CTS,
        "flight",
      ),
      visit("2026-02-26T02:40:00Z", "2026-02-26T05:00:00Z", CTS),
    ],
    findAirport,
  );
  // 前の記録との空白は、機内で途切れただけなので別の便にしない
  expect(flights).toHaveLength(1);
  expect(flights[0]).toMatchObject({ from: "HND", to: "CTS" });
});

test("「飛行機」の記録が無くても、空白のあいだに飛行機の速さで動いていれば便にする", () => {
  const flights = extractFlights(
    [
      // 長崎空港 → (記録なし 2 時間) → 羽田
      visit("2026-02-24T03:00:00Z", "2026-02-24T04:00:00Z", NGS),
      visit("2026-02-24T06:00:00Z", "2026-02-24T07:00:00Z", HND),
      // 種類が分からない移動でも、羽田 → 鹿児島を 1 時間 50 分なら飛行機
      move("2026-02-28T00:00:00Z", "2026-02-28T01:50:00Z", HND, KOJ, "other"),
      // 新幹線（東京 → 新大阪 2 時間 27 分）は飛行機にしない
      move(
        "2026-03-01T00:00:00Z",
        "2026-03-01T02:27:00Z",
        TOKYO_HOTEL,
        { lat: 34.733, lng: 135.5 },
        "train",
      ),
      // 位置の飛び（羽田 → 鹿児島を 10 分）は記録の誤りとして除く
      visit("2026-03-02T00:00:00Z", "2026-03-02T01:00:00Z", HND),
      visit("2026-03-02T01:10:00Z", "2026-03-02T02:00:00Z", KOJ),
    ],
    findAirport,
  );
  expect(flights.map((f) => `${f.from}-${f.to}`)).toEqual([
    "NGS-HND",
    "HND-KOJ",
  ]);
  expect(flights[0]).toMatchObject({
    departedAt: "2026-02-24T04:00:00Z",
    arrivedAt: "2026-02-24T06:00:00Z",
  });
});

test("空港を直すときに使う：一覧にある空港か、空港どうしの距離", () => {
  expect(isKnownAirport("HND")).toBe(true);
  expect(isKnownAirport("ZZZ")).toBe(false);
  expect(Math.round(airportDistanceKm("HND", "CTS") ?? 0)).toBeGreaterThan(800);
  expect(airportDistanceKm("HND", "ZZZ")).toBeNull();
});

test("搭乗券の表示：日本時間の日付と時刻、飛行時間、デザインの自動の選び方", () => {
  expect(passDate("2026-09-09T23:30:00Z")).toBe("10 SEP 2026");
  expect(passTime("2026-09-10T00:05:00Z")).toBe("09:05");
  expect(flightDuration("2026-09-10T00:05:00Z", "2026-09-10T02:00:00Z")).toBe(
    "1h55m",
  );
  expect(defaultDesign("JP", "JP")).toBe("classic");
  expect(defaultDesign("JP", "KR")).toBe("noir");
  expect(defaultDesign("", "JP")).toBe("mono");
  // 飾りのバーコードは、同じ便なら毎回同じ
  expect(decorativeBars("abc")).toEqual(decorativeBars("abc"));
  expect(decorativeBars("abc")).not.toEqual(decorativeBars("abd"));
});
