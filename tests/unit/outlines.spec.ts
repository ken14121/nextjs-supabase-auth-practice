import { expect, test } from "@playwright/test";
import { getOutlineFeatures } from "@/lib/geo/outline-geojson";

test("線の地球儀：海岸線・国境・県境がそろい、日付変更線で地球を一周する線がない", () => {
  const { features } = getOutlineFeatures();
  expect(features.map((f) => f.properties.kind).sort()).toEqual([
    "border",
    "coast",
    "jp-coast",
    "pref-border",
  ]);
  for (const f of features) {
    expect(f.geometry.coordinates.length).toBeGreaterThan(0);
    for (const line of f.geometry.coordinates) {
      for (let i = 1; i < line.length; i++) {
        // となりの点との経度の差が 180 度を超えると、反対側を回る線になる
        expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThanOrEqual(180);
      }
    }
  }
});
