import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { lookupRegion } from "@/lib/geo/regions";
import { computeOutingFeatures, isClearlyDaily } from "@/lib/timeline/features";
import { buildOutings, toJstDate } from "@/lib/timeline/outings";
import { extractSegments } from "@/lib/timeline/parse";

// 架空のタイムライン（docs/samples）で、取り込みの流れをまとめて確かめる
const json = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "docs/samples/sample-timeline-osaka.json"),
    "utf8",
  ),
);
const drafts = buildOutings(extractSegments(json).segments);
const features = computeOutingFeatures(drafts);

test("外出に区切れる（日常 24 回 ＋ 旅など 13 回）", () => {
  expect(drafts).toHaveLength(37);
});

test("行った都道府県・国を判定できる", () => {
  const codes = new Set(
    drafts.flatMap((d) =>
      d.stops
        .map((s) => lookupRegion(s.location.lat, s.location.lng))
        .filter((c): c is string => c !== null),
    ),
  );
  expect(codes.size).toBe(16); // 15 府県 ＋ 韓国
  for (const code of ["JP-27", "JP-01", "JP-47", "KR"]) {
    expect(codes.has(code)).toBe(true);
  }
});

test("泊数を数えられる（北海道は 3 泊、年末年始の帰省は 4 泊）", () => {
  const nightsOf = (date: string) =>
    drafts.find((d) => toJstDate(d.startedAt) === date)?.nights;
  expect(nightsOf("2025-08-10")).toBe(3);
  expect(nightsOf("2025-12-29")).toBe(4);
});

test("いつもの場所だけの日は、Jev に聞かずに日常と決まる", () => {
  const ruleDaily = drafts.filter((d, i) =>
    isClearlyDaily(d.nights, features[i]),
  );
  expect(ruleDaily).toHaveLength(24);
  // 泊まりの外出は、ルールでは決めない（Jev に聞く）
  expect(ruleDaily.every((d) => d.nights === 0)).toBe(true);
});

test("ふだん行かない場所に行った日は、ルールで決めない", () => {
  const nara = drafts.findIndex((d) => toJstDate(d.startedAt) === "2025-04-05");
  expect(nara).toBeGreaterThanOrEqual(0);
  expect(features[nara].rareMinutes).toBeGreaterThan(60);
  expect(isClearlyDaily(drafts[nara].nights, features[nara])).toBe(false);
});

test("保存する数字に座標は入らない", () => {
  for (const f of features) {
    expect(Object.keys(f).sort()).toEqual([
      "frequentMinutes",
      "maxKmFromHome",
      "rareMinutes",
      "rarePlaces",
      "sometimesMinutes",
    ]);
  }
});

test("家の近所（5km 以内）だけの日は、知らない場所でも日常（バイトなどの可能性）", () => {
  const nearHome = {
    maxKmFromHome: 2,
    frequentMinutes: 0,
    sometimesMinutes: 0,
    rareMinutes: 100,
    rarePlaces: 1,
  };
  expect(isClearlyDaily(0, nearHome)).toBe(true);
  // 遠くなら、ふだん行かない場所にいた日は Jev に聞く
  expect(isClearlyDaily(0, { ...nearHome, maxKmFromHome: 30 })).toBe(false);
  // 泊まりはルールで決めない
  expect(isClearlyDaily(1, nearHome)).toBe(false);
});
