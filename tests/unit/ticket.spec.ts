import { expect, test } from "@playwright/test";
import { destinationOf, ticketKind } from "@/lib/outings/ticket";

test("切符の種類：飛行機は航空券、電車は 100km 以上で新幹線・特急", () => {
  expect(ticketKind("flight", 900).name).toBe("航空券");
  expect(ticketKind("train", 450).name).toBe("新幹線・特急券");
  expect(ticketKind("train", 40).name).toBe("乗車券");
  expect(ticketKind("car", 200).name).toBe("ドライブ");
  // 手入力の旅など、移動手段がわからないとき
  expect(ticketKind(null, null).name).toBe("旅の切符");
});

test("行き先は、住んでいる県以外で一番多くの日にいた場所。ほかは経由地", () => {
  const r = (code: string, on: string) => ({
    region_code: code,
    visited_on: on,
  });
  expect(
    destinationOf(
      [
        r("JP-12", "2026-09-10"),
        r("JP-13", "2026-09-10"),
        r("JP-26", "2026-09-11"),
        r("JP-43", "2026-09-12"),
        r("JP-43", "2026-09-13"),
        r("JP-12", "2026-09-16"),
      ],
      "JP-12",
    ),
  ).toEqual({ destination: "JP-43", via: ["JP-13", "JP-26"] });
  // 住んでいる県から出ていない
  expect(destinationOf([r("JP-12", "2026-09-10")], "JP-12")).toEqual({
    destination: null,
    via: [],
  });
});
