import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  lookupMunicipality,
  municipalityCount,
  municipalityName,
} from "@/lib/geo/municipalities";
import {
  computeMunicipalityLevels,
  type MunicipalityLookup,
} from "@/lib/timeline/municipality-levels";
import type { TimelineSegment } from "@/lib/timeline/parse";
import { extractSegments } from "@/lib/timeline/parse";

test.describe("市区町村の判定", () => {
  test("緯度経度から市区町村コードがわかる", () => {
    expect(lookupMunicipality(35.6812, 139.7671)).toBe("13101"); // 東京駅 → 千代田区
    expect(lookupMunicipality(34.6873, 135.5262)).toBe("27128"); // 大阪城 → 大阪市中央区
    expect(municipalityName("13101")).toEqual({
      prefecture: "東京都",
      name: "千代田区",
    });
    expect(municipalityCount()).toBeGreaterThan(1800);
  });

  test("海の上と海外は null", () => {
    expect(lookupMunicipality(33.0, 137.0)).toBeNull(); // 紀伊半島の南の太平洋
    expect(lookupMunicipality(37.5665, 126.978)).toBeNull(); // ソウル
  });
});

// 判定を差し替えて、経験値の決め方だけを確かめる（境界データを使わない）
const fakeLookup: MunicipalityLookup = (lat) =>
  lat > 40 ? null : `0000${Math.floor(lat) % 10}`;
const visit = (
  lat: number,
  start: string,
  end: string,
  isHome = false,
): TimelineSegment => ({
  kind: "visit",
  start,
  end,
  location: { lat, lng: 135 },
  isHome,
});

test("経験値：住居 5・宿泊 4・訪問 3・接地 2、同じ市区町村は高い方", () => {
  const levels = computeMunicipalityLevels(
    [
      visit(31, "2025-01-01T10:00:00Z", "2025-01-01T12:00:00Z", true), // 自宅
      visit(32, "2025-01-02T12:00:00Z", "2025-01-02T20:00:00Z"), // 日本時間 21:00〜翌 5:00 → 宿泊
      visit(33, "2025-01-03T01:00:00Z", "2025-01-03T02:00:00Z"), // 1 時間 → 訪問
      visit(34, "2025-01-03T03:00:00Z", "2025-01-03T03:05:00Z"), // 5 分 → 接地
      visit(34, "2025-01-05T03:00:00Z", "2025-01-05T04:00:00Z"), // 同じ市区町村にあとで 1 時間 → 訪問
    ],
    [],
    fakeLookup,
  );
  expect(levels.map((l) => [l.code, l.level])).toEqual([
    ["00001", 5],
    ["00002", 4],
    ["00003", 3],
    ["00004", 3],
  ]);
  // 日付は日本時間で、広がる方に合わせる。宿泊は帰った日も入れる
  expect(levels[1]).toMatchObject({
    firstOn: "2025-01-02",
    lastOn: "2025-01-03",
  });
  expect(levels[3]).toMatchObject({
    firstOn: "2025-01-03",
    lastOn: "2025-01-05",
  });
});

test("通過：軌跡の点の市区町村は 1。軌跡が無いときは陸の移動だけ直線で近似する", () => {
  const withPaths = computeMunicipalityLevels(
    [],
    [
      {
        on: "2025-02-01",
        points: [
          [35.5, 135],
          [36.5, 135],
          [41, 135],
        ],
      },
    ],
    fakeLookup,
  );
  expect(withPaths).toEqual([
    { code: "00005", level: 1, firstOn: "2025-02-01", lastOn: "2025-02-01" },
    { code: "00006", level: 1, firstOn: "2025-02-01", lastOn: "2025-02-01" },
  ]);

  const activity = (mode: "train" | "flight"): TimelineSegment => ({
    kind: "activity",
    start: "2025-03-01T00:00:00Z",
    end: "2025-03-01T02:00:00Z",
    from: { lat: 32.5, lng: 135 },
    to: { lat: 35.5, lng: 135 },
    distanceMeters: 330_000,
    mode,
  });
  const byTrain = computeMunicipalityLevels(
    [activity("train")],
    [],
    fakeLookup,
  );
  expect(byTrain.map((l) => l.code)).toEqual([
    "00002",
    "00003",
    "00004",
    "00005",
  ]);
  expect(
    computeMunicipalityLevels([activity("flight")], [], fakeLookup),
  ).toEqual([]);
});

test("サンプルのタイムラインで、大阪の自宅が住居になり、座標は返さない", () => {
  const json = JSON.parse(
    readFileSync("docs/samples/sample-timeline-osaka.json", "utf8"),
  );
  const { segments, paths } = extractSegments(json);
  const levels = computeMunicipalityLevels(segments, paths, lookupMunicipality);
  expect(levels.find((l) => l.level === 5)?.code).toBe("27128");
  expect(levels.filter((l) => l.level === 4).length).toBeGreaterThan(5);
  // 返すのはコード・経験値・日付だけ
  for (const l of levels) {
    expect(Object.keys(l).sort()).toEqual([
      "code",
      "firstOn",
      "lastOn",
      "level",
    ]);
  }
});
