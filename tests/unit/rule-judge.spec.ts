import { expect, test } from "@playwright/test";
import type { JevContext } from "@/lib/jev/state";
import { ruleJudge } from "@/lib/outings/rule-judge";

const ctx: JevContext = {
  homeRegion: "JP-12",
  visitedDays: new Map([
    ["JP-12", 600],
    ["JP-13", 200],
    ["JP-01", 45], // 実家
    ["JP-47", 3],
  ]),
};
const f = (maxKmFromHome: number, rareMinutes = 0, sometimesMinutes = 0) => ({
  maxKmFromHome,
  frequentMinutes: 300,
  sometimesMinutes,
  rareMinutes,
  rarePlaces: rareMinutes > 0 ? 1 : 0,
});
// ふつうの時期（帰省の多い時期ではない）
const SPRING = ["2026-03-10T00:00:00Z", "2026-03-14T00:00:00Z"] as const;
const judge = (
  nights: number,
  regions: string[],
  features: ReturnType<typeof f> | null,
  distance = 0,
  [started_at, ended_at]: readonly [string, string] = SPRING,
) =>
  ruleJudge(
    {
      started_at,
      ended_at,
      nights,
      region_codes: regions,
      features,
      distance_km: distance,
    },
    ctx,
  ).label;

test("泊まっていない外出：日常・おでかけ・日帰り", () => {
  // 学校だけの日
  expect(judge(0, ["JP-12"], f(12))).toBe("daily");
  // 都心で遊んだ（ふだん行かない場所に 3 時間、30km）
  expect(judge(0, ["JP-12", "JP-13"], f(30, 180, 60))).toBe("outing");
  // 鎌倉へ日帰り（80km）
  expect(judge(0, ["JP-12", "JP-13", "JP-14"], f(80, 300))).toBe("day_trip");
  // いつもの場所以外にいたのが 2 時間に満たない
  expect(judge(0, ["JP-12"], f(20, 40, 60))).toBe("daily");
});

test("泊まった外出：旅行・帰省・日常", () => {
  // 沖縄に旅行
  expect(judge(4, ["JP-12", "JP-47"], f(1500, 3000))).toBe("trip");
  // 実家（何十日も行っている北海道）に年末年始に帰省
  expect(
    judge(3, ["JP-12", "JP-01"], f(800, 200), 0, [
      "2025-12-29T00:00:00Z",
      "2026-01-02T00:00:00Z",
    ]),
  ).toBe("homecoming");
  // 同じ北海道でも、ふつうの時期なら旅行
  expect(judge(3, ["JP-12", "JP-01"], f(800, 200))).toBe("trip");
  // 東京の友人宅に泊まった（よく行く近くの場所）
  expect(judge(1, ["JP-12", "JP-13"], f(35, 300))).toBe("daily");
  // 県内の学校に泊まり込み
  expect(judge(1, ["JP-12"], f(15))).toBe("daily");
});

test("帰省がほとんど無い人は、年末年始に実家の方へ泊まっても旅行", () => {
  const input = {
    started_at: "2025-12-29T00:00:00Z",
    ended_at: "2026-01-02T00:00:00Z",
    nights: 3,
    region_codes: ["JP-12", "JP-01"],
    features: f(800, 200),
    distance_km: 0,
  };
  expect(ruleJudge(input, ctx).label).toBe("homecoming");
  expect(ruleJudge(input, { ...ctx, homecoming: false }).label).toBe("trip");
});

test("おでかけの境目は、変えて比べられる", () => {
  // ふだん行かない場所 40 分・ときどき行く場所 60 分（20km）
  const input = {
    started_at: SPRING[0],
    ended_at: SPRING[1],
    nights: 0,
    region_codes: ["JP-12", "JP-13"],
    features: f(20, 40, 60),
    distance_km: 0,
  };
  // 今の設定（いつもの場所以外ぜんぶで 120 分）では日常
  expect(ruleJudge(input, ctx).label).toBe("daily");
  expect(ruleJudge(input, ctx, { outingMinutes: 90 }).label).toBe("outing");
  expect(
    ruleJudge(input, ctx, { outingMinutes: 30, outingMinutesOf: "rare" }).label,
  ).toBe("outing");
  expect(
    ruleJudge(input, ctx, { outingMinutes: 60, outingMinutesOf: "rare" }).label,
  ).toBe("daily");
});

test("地点の数字が無い外出は、移動した距離から目安を出す", () => {
  expect(judge(0, ["JP-12", "JP-11"], null, 200)).toBe("day_trip");
  expect(judge(2, ["JP-12", "JP-47"], null, 3000)).toBe("trip");
});
