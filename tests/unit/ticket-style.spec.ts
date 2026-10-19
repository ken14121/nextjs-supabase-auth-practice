import { expect, test } from "@playwright/test";
import {
  compactStyle,
  readableOn,
  readTicketStyle,
  stampLines,
  ticketStyleSchema,
} from "@/lib/outings/ticket-style";

test("切符の飾り：色・マーク・絵文字・はんこを確かめる", () => {
  expect(
    ticketStyleSchema.parse({
      accent: "#2F5D8A",
      mark: "heart",
      emoji: "🍣🗻",
      stamp: "初めての沖縄",
    }),
  ).toEqual({
    accent: "#2f5d8a",
    mark: "heart",
    emoji: "🍣🗻",
    stamp: "初めての沖縄",
  });
  // 何も付けないのもよい
  expect(ticketStyleSchema.parse({})).toEqual({});
  // 合成された絵文字（国旗・肌の色・家族）も 1 つと数える
  expect(ticketStyleSchema.safeParse({ emoji: "🇯🇵👍🏽👨‍👩‍👧" }).success).toBe(
    true,
  );

  for (const bad of [
    { accent: "red" },
    { accent: "#12345" },
    { mark: "skull" },
    { emoji: "🍣🍣🍣🍣" }, // 4 つは多い
    { emoji: "すし" }, // 絵文字ではない
    { emoji: "<b>" },
    { stamp: "123456789" }, // 9 文字は多い
    { color: "#ffffff" }, // 知らない項目
  ]) {
    expect(ticketStyleSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(
      false,
    );
  }
});

test("DB から読んだ飾りが壊れていたら、飾りなしとして扱う", () => {
  expect(readTicketStyle({ mark: "star" })).toEqual({ mark: "star" });
  expect(readTicketStyle(null)).toEqual({});
  expect(readTicketStyle([])).toEqual({});
  expect(readTicketStyle({ accent: "javascript:" })).toEqual({});
  expect(compactStyle({ emoji: "", stamp: "記念", mark: undefined })).toEqual({
    stamp: "記念",
  });
});

test("帯の文字色と、はんこの行の分け方", () => {
  expect(readableOn("#c8432c")).toBe("#ffffff");
  expect(readableOn("#1d1c1a")).toBe("#ffffff");
  expect(readableOn("#f6f3ec")).toBe("#1d1c1a");
  expect(readableOn("#c9a227")).toBe("#1d1c1a");
  expect(stampLines("")).toEqual([]);
  expect(stampLines("記念")).toEqual(["記念"]);
  expect(stampLines("乗車記念")).toEqual(["乗車", "記念"]);
  expect(stampLines("初めての沖縄")).toEqual(["初めて", "の沖縄"]);
  expect(stampLines("北海道旅行")).toEqual(["北海道", "旅行"]);
});
