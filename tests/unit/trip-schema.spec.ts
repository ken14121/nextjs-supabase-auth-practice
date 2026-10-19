import { expect, test } from "@playwright/test";
import { nightsBetween, tripSchema } from "@/lib/trips/schema";

const base = {
  startDate: "2024-08-01",
  endDate: "2024-08-03",
  kind: "trip",
  regions: ["JP-01"],
  memo: "",
};

test("手入力の旅：正しい入力は通る", () => {
  expect(tripSchema.safeParse(base).success).toBe(true);
  expect(nightsBetween("2024-08-01", "2024-08-03")).toBe(2);
});

test("手入力の旅：おかしな入力は弾く", () => {
  const fails = (patch: Partial<typeof base>) =>
    tripSchema.safeParse({ ...base, ...patch }).success === false;
  expect(fails({ endDate: "2024-07-31" })).toBe(true); // 帰った日が出発より前
  expect(fails({ endDate: "2999-01-01" })).toBe(true); // 未来の日付
  expect(fails({ kind: "day_trip" })).toBe(true); // 日帰りなのに日付が違う
  expect(fails({ regions: [] })).toBe(true); // 県・国を選んでいない
  expect(fails({ startDate: "1900-01-01" })).toBe(true); // 1950 年より前
});
