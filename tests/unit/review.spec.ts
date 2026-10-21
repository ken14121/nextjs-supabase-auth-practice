import { expect, test } from "@playwright/test";
import type { JevContext } from "@/lib/jev/state";
import { evaluateRuleJudge, splitForReview } from "@/lib/outings/review";

const rows = [
  { id: "a", label: "trip", label_source: "user", jev_label: "trip" },
  { id: "b", label: "daily", label_source: "user", jev_label: null },
  { id: "c", label: "daily", label_source: "rule", jev_label: null },
  { id: "d", label: "outing", label_source: "jev", jev_label: "outing" },
  { id: "e", label: null, label_source: null, jev_label: null },
];
const ids = (list: { id: string }[]) => list.map((r) => r.id);

test("Jev を使える人は、Jev の答えが残っている外出だけを確かめる", () => {
  const { reviewed, unchecked } = splitForReview(rows, true);
  expect(ids(reviewed)).toEqual(["a"]);
  expect(ids(unchecked)).toEqual(["d"]);
});

test("Jev を使えない人は、ルールで判定された外出を確かめる", () => {
  const { reviewed, unchecked } = splitForReview(rows, false);
  // 本人が決めた答えがあれば、Jev の答えが無くても比べられる
  expect(ids(reviewed)).toEqual(["a", "b"]);
  expect(ids(unchecked)).toEqual(["c"]);
});

test("ルールだけで判定していたら何件合っていたかを、保存した材料から数える", () => {
  const ctx: JevContext = {
    homeRegion: "JP-12",
    visitedDays: new Map([["JP-12", 600]]),
  };
  const outing = (maxKmFromHome: number, rareMinutes: number) => ({
    started_at: "2026-03-10T00:00:00Z",
    ended_at: "2026-03-10T10:00:00Z",
    nights: 0,
    distance_km: maxKmFromHome * 2,
    region_codes: ["JP-12"],
    features: {
      maxKmFromHome,
      frequentMinutes: 300,
      sometimesMinutes: 0,
      rareMinutes,
      rarePlaces: rareMinutes > 0 ? 1 : 0,
    },
  });
  const result = evaluateRuleJudge(
    [
      { ...outing(80, 60), userLabel: "day_trip" }, // 50 km 以上 → 日帰り（当たり）
      { ...outing(10, 180), userLabel: "outing" }, // 120 分以上 → おでかけ（当たり）
      { ...outing(10, 180), userLabel: "daily" }, // ルールはおでかけ（外れ）
    ],
    ctx,
  );
  expect(result.total).toBe(3);
  expect(result.correct).toBe(2);
  expect(result.confusion.outing.daily).toBe(1);
});
