import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { airportLabel, nearestAirport } from "@/lib/geo/airports";
import {
  decorativeBars,
  defaultDesign,
  flightDuration,
  passDate,
  passTime,
} from "@/lib/outings/boarding-pass";
import { extractFlights } from "@/lib/timeline/flights";
import { extractSegments } from "@/lib/timeline/parse";

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
    nearestAirport,
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
  const flights = extractFlights(
    extractSegments(json).segments,
    nearestAirport,
  );
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
