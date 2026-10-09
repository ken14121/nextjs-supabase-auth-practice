import { expect, test } from "@playwright/test";
import { decideLabel } from "@/lib/jev/decide";

// Jev の「はい / いいえ」の確率と泊数から、外出の種類を決める流れ
test.describe("decideLabel", () => {
  test("日常の確率が高ければ、泊まっていても日常", () => {
    expect(
      decideLabel({ nights: 1, pDaily: 0.9, pHomecoming: 0.1, pDayTrip: 0.1 }),
    ).toEqual({ label: "daily", confidence: 0.9 });
  });

  test("泊まらず、遠くへの日帰り旅行なら日帰り", () => {
    const r = decideLabel({
      nights: 0,
      pDaily: 0.1,
      pHomecoming: 0.1,
      pDayTrip: 0.8,
    });
    expect(r.label).toBe("day_trip");
    expect(r.confidence).toBeCloseTo(0.8);
  });

  test("泊まらず、近場で遊んだならおでかけ", () => {
    const r = decideLabel({
      nights: 0,
      pDaily: 0.2,
      pHomecoming: 0.9,
      pDayTrip: 0.3,
    });
    expect(r.label).toBe("outing");
    expect(r.confidence).toBeCloseTo(0.7);
  });

  test("泊まりで帰省の確率が高ければ帰省、低ければ旅行", () => {
    expect(
      decideLabel({ nights: 4, pDaily: 0.1, pHomecoming: 0.8, pDayTrip: 0 })
        .label,
    ).toBe("homecoming");
    expect(
      decideLabel({ nights: 2, pDaily: 0.1, pHomecoming: 0.2, pDayTrip: 0 })
        .label,
    ).toBe("trip");
  });

  test("確かさは掛け算ではなく、2 つのうち低い方", () => {
    // 掛け算だと 0.85 × 0.8 = 0.68 になり、はっきりした旅行に「要確認」が付いてしまう
    const r = decideLabel({
      nights: 5,
      pDaily: 0.15,
      pHomecoming: 0.2,
      pDayTrip: 0,
    });
    expect(r.confidence).toBeCloseTo(0.8);
  });

  test("日常の境目は 45%。境目ぎりぎりの日常には「要確認」が付く確かさになる", () => {
    const r = decideLabel({
      nights: 0,
      pDaily: 0.46,
      pHomecoming: 0,
      pDayTrip: 0.1,
    });
    expect(r).toEqual({ label: "daily", confidence: 0.46 });
    expect(
      decideLabel({ nights: 0, pDaily: 0.44, pHomecoming: 0, pDayTrip: 0.1 })
        .label,
    ).toBe("outing");
  });
});
