import { expect, test } from "@playwright/test";
import {
  assignPassedRegions,
  passedRegionsByDay,
  type RegionLookup,
} from "@/lib/timeline/passed-regions";

// 緯度 0.5 度ごとに県が変わる判定（境界データを使わない）
const fakeLookup: RegionLookup = (lat) =>
  lat > 40 ? null : `JP-${Math.floor(lat * 2)}`;

test("通った県：軌跡の点と、点と点の間（50km まで）で通った県・国を日ごとに集める", () => {
  const passed = passedRegionsByDay(
    [
      // 新幹線のように 44km 空いた 2 点：間の県（JP-70）も通ったことになる
      {
        on: "2025-05-01",
        points: [
          [34.9, 135],
          [35.3, 135],
        ],
      },
      // 海の上（null）は数えない
      { on: "2025-05-02", points: [[41, 135]] },
    ],
    fakeLookup,
  );
  expect([...(passed.get("2025-05-01") ?? [])].sort()).toEqual([
    "JP-69",
    "JP-70",
  ]);
  expect(passed.has("2025-05-02")).toBe(false);
});

test("通った県：その日にかかっている外出のうち、一番遠くまで移動した外出に付ける。立ち寄った県は足さない", () => {
  const passed = new Map([
    ["2025-05-01", new Set(["JP-13", "JP-22", "JP-27"])],
    ["2025-05-09", new Set(["JP-13"])],
  ]);
  const outings = [
    // 日本時間 5/1 の朝の通学
    {
      id: "commute",
      startedAt: "2025-04-30T23:00:00Z",
      endedAt: "2025-05-01T00:00:00Z",
      distanceKm: 12,
    },
    // 日本時間 5/1〜5/2 の新幹線の旅
    {
      id: "trip",
      startedAt: "2025-05-01T01:00:00Z",
      endedAt: "2025-05-02T10:00:00Z",
      distanceKm: 520,
    },
  ];
  // 東京と大阪は立ち寄った県として、もう行がある
  const existing = new Set(["trip|JP-13|2025-05-01", "trip|JP-27|2025-05-01"]);
  expect(assignPassedRegions(passed, outings, existing)).toEqual([
    { outing_id: "trip", region_code: "JP-22", visited_on: "2025-05-01" },
  ]);
  // 外出の無い日の軌跡は付ける先が無いので足さない
  expect(existing.has("trip|JP-22|2025-05-01")).toBe(true);
});
