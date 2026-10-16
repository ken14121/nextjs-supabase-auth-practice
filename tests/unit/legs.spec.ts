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

test("バスなどは、出発地と到着地を名前で入れる（30 文字まで）", () => {
  const bus = {
    kind: "ground",
    mode: "bus",
    outingId: id,
    date: "2022-11-12",
    depTime: "",
    arrTime: "",
    from: " 広島 ",
    to: "松山",
  };
  const parsed = legSchema.safeParse(bus);
  expect(parsed.success).toBe(true);
  // 前後の空白は消す
  expect(parsed.success && parsed.data.from).toBe("広島");
  expect(legSchema.safeParse({ ...bus, from: "" }).success).toBe(false);
  expect(legSchema.safeParse({ ...bus, to: "あ".repeat(31) }).success).toBe(
    false,
  );
  expect(legSchema.safeParse({ ...bus, mode: "rocket" }).success).toBe(false);
  // 終わりの日は、始まりの日より後
  expect(legSchema.safeParse({ ...bus, endDate: "2022-11-15" }).success).toBe(
    true,
  );
  expect(legSchema.safeParse({ ...bus, endDate: "2022-11-10" }).success).toBe(
    false,
  );
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
  // 何日かかけた移動：終わりの日に着く
  expect(legTimes("2022-11-11", "", "", "2022-11-15")).toEqual({
    departedAt: "2022-11-10T15:00:00.000Z",
    arrivedAt: "2022-11-14T15:00:00.000Z",
    hasTimes: false,
  });
  expect(legTimes("2022-11-11", "09:00", "17:30", "2022-11-15").arrivedAt).toBe(
    "2022-11-15T08:30:00.000Z",
  );
  // 時刻なし：その日の 0:00
  expect(legTimes("2024-09-18", "", "")).toEqual({
    departedAt: "2024-09-17T15:00:00.000Z",
    arrivedAt: "2024-09-17T15:00:00.000Z",
    hasTimes: false,
  });
});
