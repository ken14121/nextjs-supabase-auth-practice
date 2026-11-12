import { densePathPoints } from "./municipality-levels";
import { toJstDate } from "./outings";
import type { DayPath } from "./parse";

// 新幹線などで通っただけの県・国も「行った県」に数える（市区町村の「通過」と同じ考え方）。
// 県・国は立ち寄った地点（visit）から決めているので、立ち寄らずに通り過ぎた県は抜けていた。
// 軌跡の点（と、点と点の間を補った点）から日ごとに通った県・国を集め、その日の外出に付ける

export type RegionLookup = (lat: number, lng: number) => string | null;

export function passedRegionsByDay(
  paths: DayPath[],
  lookup: RegionLookup,
): Map<string, Set<string>> {
  const byDay = new Map<string, Set<string>>();
  // 同じあたりの点を何度も調べないよう、約 1km 単位でまとめて覚えておく（県・国の判定には十分）
  const cache = new Map<string, string | null>();
  for (const path of paths) {
    const codes = byDay.get(path.on) ?? new Set<string>();
    for (const [lat, lng] of densePathPoints(path.points)) {
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      if (!cache.has(key)) cache.set(key, lookup(lat, lng));
      const code = cache.get(key);
      if (code) codes.add(code);
    }
    if (codes.size > 0) byDay.set(path.on, codes);
  }
  return byDay;
}

export type OutingSpan = {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
};

export type PassedRegionRow = {
  outing_id: string;
  region_code: string;
  visited_on: string;
};

// 日ごとに通った県・国を、その日にかかっている外出のうち、一番遠くまで移動した外出に付ける
//（軌跡の点には時刻が無いので、同じ日に外出がいくつかあるときは、長い移動のほうとみなす）。
// すでに同じ外出・県・日付の行があるもの（立ち寄った県）は足さない
export function assignPassedRegions(
  passed: Map<string, Set<string>>,
  outings: OutingSpan[],
  existing: Set<string>,
): PassedRegionRow[] {
  const rows: PassedRegionRow[] = [];
  for (const [day, codes] of passed) {
    let best: OutingSpan | null = null;
    for (const o of outings) {
      if (toJstDate(o.startedAt) > day || toJstDate(o.endedAt) < day) continue;
      if (!best || o.distanceKm > best.distanceKm) best = o;
    }
    if (!best) continue;
    for (const code of codes) {
      const key = `${best.id}|${code}|${day}`;
      if (existing.has(key)) continue;
      existing.add(key);
      rows.push({ outing_id: best.id, region_code: code, visited_on: day });
    }
  }
  return rows;
}
