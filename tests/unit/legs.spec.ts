import { expect, test } from "@playwright/test";
import { legSchema, legTimes } from "@/lib/trips/legs";

const id = "00000000-0000-4000-8000-000000000001";

test("手で足す便・乗車の入力を確かめる", () => {
  const flight = {
    kind: "flight",
    outingId: id,
    date: "2024-09-18",
    depTime: "08:30",
    arrTime: "11:45",
    from: "NRT",
    to: "OKA",
  };
  expect(legSchema.safeParse(flight).success).toBe(true);
  // 時刻は両方とも空でもよい
  expect(
    legSchema.safeParse({ ...flight, depTime: "", arrTime: "" }).success,
  ).toBe(true);
  // 片方だけ・出発と到着が同じ・コードの形が違う、はだめ
  expect(legSchema.safeParse({ ...flight, arrTime: "" }).success).toBe(false);
  expect(legSchema.safeParse({ ...flight, to: "NRT" }).success).toBe(false);
  expect(legSchema.safeParse({ ...flight, from: "nrt" }).success).toBe(false);
  expect(legSchema.safeParse({ ...flight, depTime: "25:00" }).success).toBe(
    false,
  );
  expect(
    legSchema.safeParse({
      ...flight,
      kind: "ride",
      from: "tokyo",
      to: "hiroshima",
    }).success,
  ).toBe(true);
});

test("日付と時刻から出発・到着の日時を作る（日本時間）", () => {
  expect(legTimes("2024-09-18", "08:30", "11:45")).toEqual({
    departedAt: "2024-09-17T23:30:00.000Z",
    arrivedAt: "2024-09-18T02:45:00.000Z",
    hasTimes: true,
  });
  // 夜に出て日付をまたいで着く
  expect(legTimes("2024-09-18", "23:30", "01:10").arrivedAt).toBe(
    "2024-09-18T16:10:00.000Z",
  );
  // 時刻なし：その日の 0:00
  expect(legTimes("2024-09-18", "", "")).toEqual({
    departedAt: "2024-09-17T15:00:00.000Z",
    arrivedAt: "2024-09-17T15:00:00.000Z",
    hasTimes: false,
  });
});
