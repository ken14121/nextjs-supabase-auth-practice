import { expect, test } from "@playwright/test";
import { destinationOf, routeOf, ticketKind } from "@/lib/outings/ticket";

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

test("行った県を訪れた順に並べる（住んでいる県は除く）", () => {
  // 修学旅行：広島 → 愛媛 → 香川 → 徳島 → 兵庫（記録の並びはばらばらでも、日付の順）
  const regions = [
    { region_code: "JP-12", visited_on: "2022-11-11" },
    { region_code: "JP-36", visited_on: "2022-11-14" },
    { region_code: "JP-34", visited_on: "2022-11-11" },
    { region_code: "JP-38", visited_on: "2022-11-12" },
    { region_code: "JP-37", visited_on: "2022-11-13" },
    { region_code: "JP-34", visited_on: "2022-11-12" },
    { region_code: "JP-28", visited_on: "2022-11-15" },
    { region_code: "JP-12", visited_on: "2022-11-15" },
  ];
  expect(routeOf(regions, "JP-12")).toEqual([
    "JP-34",
    "JP-38",
    "JP-37",
    "JP-36",
    "JP-28",
  ]);
  expect(routeOf([], "JP-12")).toEqual([]);
});
