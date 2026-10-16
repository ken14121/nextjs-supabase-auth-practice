import { expect, test } from "@playwright/test";
import {
  compareRegions,
  summarizeVisits,
  toCountries,
} from "@/lib/friends/compare";
import { friendCodeSchema } from "@/lib/friends/schema";
import { accuracyByDailyThreshold, evaluateJev } from "@/lib/jev/evaluate";

test("友達と比べて、どちらも / 自分だけ / 友達だけ に分ける", () => {
  expect(
    compareRegions(["JP-13", "JP-01", "US"], ["JP-13", "JP-27", "KR"]),
  ).toEqual({
    mine: ["JP-01", "US"],
    theirs: ["JP-27", "KR"],
    both: ["JP-13"],
  });
  expect(toCountries(["JP-13", "JP-01", "US"]).sort()).toEqual(["JP", "US"]);
});

test("友達の訪問地を、県・国ごとの日数にまとめる（同じ日は 1 日）", () => {
  const [tokyo] = summarizeVisits([
    { region_code: "JP-13", visited_on: "2026-01-02" },
    { region_code: "JP-13", visited_on: "2026-01-02" },
    { region_code: "JP-13", visited_on: "2026-03-01" },
  ]);
  expect(tokyo).toEqual({
    region_code: "JP-13",
    visited_days: 2,
    first_visited_on: "2026-01-02",
    last_visited_on: "2026-03-01",
  });
});

test("フレンドコードは 8 文字の英数字（大文字・空白は直す）", () => {
  expect(friendCodeSchema.parse(" 1A2B3C4D ")).toBe("1a2b3c4d");
  expect(friendCodeSchema.safeParse("1a2b3c4").success).toBe(false);
  expect(friendCodeSchema.safeParse("zzzzzzzz").success).toBe(false);
});

test("Jev の正解率と、確率の当てはまりを数える", () => {
  const r = evaluateJev([
    {
      jevLabel: "daily",
      userLabel: "daily",
      jevConfidence: 0.9,
      jevPDaily: 0.9,
    },
    {
      jevLabel: "daily",
      userLabel: "outing",
      jevConfidence: 0.6,
      jevPDaily: 0.6,
    },
    { jevLabel: "trip", userLabel: "trip", jevConfidence: 0.8, jevPDaily: 0.1 },
    {
      jevLabel: "trip",
      userLabel: "homecoming",
      jevConfidence: 0.55,
      jevPDaily: 0.2,
    },
  ]);
  expect(r.total).toBe(4);
  expect(r.accuracy).toBe(0.5);
  expect(r.confusion.daily.outing).toBe(1);
  // 要確認（70% 未満）の 2 件はどちらも外れ、それ以外の 2 件は当たり
  expect(r.bySureness.map((b) => b.accuracy)).toEqual([1, 0]);
  // 0.6 や 0.2 のような境目の値も、どれか 1 つの箱にだけ入る
  expect(r.dailyCalibration.reduce((n, b) => n + b.count, 0)).toBe(4);
});

test("「日常」の境目を変えたときの正解率を、Jev に聞き直さずに計算できる", () => {
  const base = { nights: 0, pHomecoming: 0, pDayTrip: 0.1, byRule: false };
  const rows = [
    // 確率 0.45 の日常：境目 0.5 では外れ、0.4 なら当たる
    { ...base, userLabel: "daily" as const, pDaily: 0.45 },
    // 確率 0.2 のおでかけ：どちらでも当たる
    { ...base, userLabel: "outing" as const, pDaily: 0.2 },
    // ルールで日常に決まる外出は、確率に関係なく日常
    { ...base, userLabel: "daily" as const, pDaily: 0.1, byRule: true },
  ];
  const [low, current] = accuracyByDailyThreshold(rows, [0.4, 0.5]);
  expect(low).toEqual({ threshold: 0.4, correct: 3, accuracy: 1 });
  expect(current.correct).toBe(2);
});
