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
const judge = (
  nights: number,
  regions: string[],
  features: ReturnType<typeof f> | null,
  distance = 0,
) =>
  ruleJudge(
    { nights, region_codes: regions, features, distance_km: distance },
    ctx,
  ).label;

test("泊まっていない外出：日常・おでかけ・日帰り", () => {
  // 学校だけの日
  expect(judge(0, ["JP-12"], f(12))).toBe("daily");
  // 都心で遊んだ（ふだん行かない場所に 3 時間、30km）
  expect(judge(0, ["JP-12", "JP-13"], f(30, 180, 60))).toBe("outing");
  // 鎌倉へ日帰り（80km）
  expect(judge(0, ["JP-12", "JP-13", "JP-14"], f(80, 300))).toBe("day_trip");
  // ふだん行かない場所にちょっとだけ寄った
  expect(judge(0, ["JP-12"], f(20, 40, 90))).toBe("daily");
});

test("泊まった外出：旅行・帰省・日常", () => {
  // 沖縄に旅行
  expect(judge(4, ["JP-12", "JP-47"], f(1500, 3000))).toBe("trip");
  // 実家（何十日も行っている北海道）に帰省
  expect(judge(3, ["JP-12", "JP-01"], f(800, 200))).toBe("homecoming");
  // 東京の友人宅に泊まった（よく行く近くの場所）
  expect(judge(1, ["JP-12", "JP-13"], f(35, 300))).toBe("daily");
  // 県内の学校に泊まり込み
  expect(judge(1, ["JP-12"], f(15))).toBe("daily");
});

test("地点の数字が無い外出は、移動した距離から目安を出す", () => {
  expect(judge(0, ["JP-12", "JP-11"], null, 200)).toBe("day_trip");
  expect(judge(2, ["JP-12", "JP-47"], null, 3000)).toBe("trip");
});
