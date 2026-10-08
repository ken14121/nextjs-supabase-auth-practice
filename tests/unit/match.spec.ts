import { expect, test } from "@playwright/test";
import { matchOutings } from "@/lib/timeline/match";

const t = (hhmm: string, day = "2026-09-10") => `${day}T${hhmm}:00+09:00`;

test("開始時刻が数分ずれても、時間が重なれば同じ外出として引き継ぐ", () => {
  const r = matchOutings(
    [{ startedAt: t("08:03"), endedAt: t("20:00", "2026-09-15") }],
    [
      {
        id: "old",
        startedAt: t("08:00"),
        endedAt: t("20:00", "2026-09-15"),
        userLabeled: false,
      },
    ],
  );
  expect(r).toEqual({ matchedIds: ["old"], unmatchedIds: [] });
});

test("すでに重複している 2 件は、1 件を引き継ぎ、もう 1 件は消す対象にする", () => {
  const r = matchOutings(
    [{ startedAt: t("08:00"), endedAt: t("20:00") }],
    [
      {
        id: "a",
        startedAt: t("08:00"),
        endedAt: t("19:00"),
        userLabeled: false,
      },
      {
        id: "b",
        startedAt: t("08:03"),
        endedAt: t("20:00"),
        userLabeled: true,
      },
    ],
  );
  // 本人が判定を決めた b を優先して残す
  expect(r.matchedIds).toEqual(["b"]);
  expect(r.unmatchedIds).toEqual(["a"]);
});

test("重ならない新しい外出は追加、どれとも重ならない古い外出は消す対象", () => {
  const r = matchOutings(
    [
      { startedAt: t("08:00"), endedAt: t("12:00") },
      { startedAt: t("15:00"), endedAt: t("18:00") },
    ],
    [
      {
        id: "morning",
        startedAt: t("08:10"),
        endedAt: t("11:50"),
        userLabeled: false,
      },
      {
        id: "night",
        startedAt: t("21:00"),
        endedAt: t("23:00"),
        userLabeled: false,
      },
    ],
  );
  expect(r.matchedIds).toEqual(["morning", null]);
  expect(r.unmatchedIds).toEqual(["night"]);
});

test("1 つの古い外出は、新しい外出 1 つにだけ引き継ぐ", () => {
  // 前は 1 つだった外出が、新しいファイルでは 2 つに分かれた
  const r = matchOutings(
    [
      { startedAt: t("08:00"), endedAt: t("12:00") },
      { startedAt: t("13:00"), endedAt: t("18:00") },
    ],
    [
      {
        id: "whole",
        startedAt: t("08:00"),
        endedAt: t("18:00"),
        userLabeled: false,
      },
    ],
  );
  expect(r.matchedIds).toEqual(["whole", null]);
  expect(r.unmatchedIds).toEqual([]);
});
