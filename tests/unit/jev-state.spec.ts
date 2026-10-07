import { expect, test } from "@playwright/test";
import { buildOutingState, seasonOf } from "@/lib/jev/state";

// Jev に渡す「外出 1 回ぶんの状況」
test("年末年始・お盆・ゴールデンウィークを見つける（年をまたいでも）", () => {
  expect(
    seasonOf("2025-12-30T10:00:00+09:00", "2026-01-02T18:00:00+09:00"),
  ).toBe("年末年始");
  expect(
    seasonOf("2025-08-12T10:00:00+09:00", "2025-08-13T18:00:00+09:00"),
  ).toBe("お盆");
  expect(
    seasonOf("2025-05-03T10:00:00+09:00", "2025-05-03T18:00:00+09:00"),
  ).toBe("ゴールデンウィーク");
  expect(
    seasonOf("2025-10-10T10:00:00+09:00", "2025-10-11T18:00:00+09:00"),
  ).toBeNull();
});

test("日本時間の日付・曜日・時刻と、よく行く場所かを渡す", () => {
  const state = buildOutingState(
    {
      started_at: "2026-09-21T23:30:00Z", // 日本時間 9/22（火）8:30
      ended_at: "2026-09-22T11:00:00Z",
      nights: 0,
      distance_km: 46.8,
      main_transport: "train",
      region_codes: ["JP-12", "JP-13"],
      features: {
        maxKmFromHome: 30.4,
        frequentMinutes: 480,
        sometimesMinutes: 0,
        rareMinutes: 0,
        rarePlaces: 0,
      },
    },
    {
      visitedDays: new Map([
        ["JP-12", 400],
        ["JP-13", 300],
      ]),
      homeRegion: "JP-12",
    },
  );
  expect(state.出発).toBe("2026-09-22（火） 08:30");
  expect(state.主な移動手段).toBe("電車");
  expect(state.住んでいる都道府県).toBe("千葉県");
  expect(state.行った場所[1]).toMatchObject({
    場所: "東京都",
    よく行く場所: true,
  });
  expect(state).toMatchObject({ いつもの場所での滞在_時間: 8 });
});
