import { expect, test } from "@playwright/test";
import {
  lineNameBetween,
  nearestShinkansenStation,
  stationName,
} from "@/lib/geo/shinkansen";
import {
  defaultRailDesign,
  railDate,
  railTime,
  rideDuration,
} from "@/lib/outings/rail-ticket";
import type { TimelineSegment } from "@/lib/timeline/parse";
import { extractShinkansenRides } from "@/lib/timeline/rail";

test("新幹線の駅：東京・新大阪・仙台。駅から遠いと null", () => {
  expect(nearestShinkansenStation(35.681, 139.766)).toBe("tokyo");
  expect(nearestShinkansenStation(34.733, 135.5)).toBe("shin-osaka");
  expect(nearestShinkansenStation(38.26, 140.882)).toBe("sendai");
  expect(nearestShinkansenStation(35.69, 139.7)).toBeNull(); // 新宿は新幹線の駅ではない
  expect(stationName("shin-osaka")).toBe("新大阪");
  expect(lineNameBetween("tokyo", "shin-osaka")).toBe("東海道新幹線");
  expect(lineNameBetween("tokyo", "hakata")).toBe("東海道・山陽新幹線");
  expect(lineNameBetween("ueno", "kanazawa")).toBe("北陸新幹線");
});

const train = (
  from: [number, number],
  to: [number, number],
  minutes: number,
): TimelineSegment => ({
  kind: "activity",
  start: "2026-08-13T01:00:00Z",
  end: new Date(
    Date.parse("2026-08-13T01:00:00Z") + minutes * 60_000,
  ).toISOString(),
  from: { lat: from[0], lng: from[1] },
  to: { lat: to[0], lng: to[1] },
  distanceMeters: 0,
  mode: "train",
});

test("新幹線の駅どうしを速く移動した電車だけを、新幹線の乗車にする", () => {
  const rides = extractShinkansenRides(
    [
      train([35.681, 139.767], [34.733, 135.5], 147), // 東京 → 新大阪 2 時間 27 分
      train([35.681, 139.767], [34.733, 135.5], 480), // 同じ区間を 8 時間（在来線）
      train([35.681, 139.767], [35.628, 139.738], 10), // 東京 → 品川（近すぎる）
      train([35.69, 139.7], [34.733, 135.5], 150), // 新宿から（新幹線の駅ではない）
    ],
    nearestShinkansenStation,
  );
  expect(rides).toHaveLength(1);
  expect(rides[0]).toMatchObject({ from: "tokyo", to: "shin-osaka" });
  expect(rides[0].distanceKm).toBeGreaterThan(390);
  // 駅の id と時刻と距離だけで、座標は持たない
  expect(Object.keys(rides[0]).sort()).toEqual([
    "arrivedAt",
    "departedAt",
    "distanceKm",
    "from",
    "to",
  ]);
});

test("切符の表示：日本時間の日付・時刻・所要時間、デザインの自動の選び方", () => {
  expect(railDate("2026-08-12T16:00:00Z")).toBe("2026年8月13日");
  expect(railTime("2026-08-13T01:00:00Z")).toBe("10:00");
  expect(rideDuration("2026-08-13T01:00:00Z", "2026-08-13T03:27:00Z")).toBe(
    "2時間27分",
  );
  expect(rideDuration("2026-08-13T01:00:00Z", "2026-08-13T01:40:00Z")).toBe(
    "40分",
  );
  // 選んでいなければ路線の色
  expect(defaultRailDesign("東北新幹線")).toBe("tohoku");
  expect(defaultRailDesign("東海道・山陽新幹線")).toBe("tokaido");
  expect(defaultRailDesign("北海道新幹線")).toBe("hokkaido");
  expect(defaultRailDesign("西九州新幹線")).toBe("kyushu");
  expect(defaultRailDesign("上越新幹線")).toBe("hokuriku");
});
