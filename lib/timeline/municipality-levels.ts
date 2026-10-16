import { toJstDate } from "./outings";
import type { DayPath, TimelineSegment } from "./parse";

// 市区町村ごとの「経験値」を数える（経県値と同じ考え方を、市区町村でやる）。
//   5 住居：自宅がある
//   4 宿泊：日本時間の夜中 3 時をまたいで滞在した
//   3 訪問：15 分以上滞在した
//   2 接地：15 分未満だけ立ち寄った（乗り換えなど）
//   1 通過：電車・車などで通り過ぎた（飛行機は除く）
// 同じ市区町村は、一番高い経験値を残す。座標は返さない（保存するのはコードと経験値と日付だけ）

export const MUNICIPALITY_LEVELS = [
  { level: 5, name: "住居" },
  { level: 4, name: "宿泊" },
  { level: 3, name: "訪問" },
  { level: 2, name: "接地" },
  { level: 1, name: "通過" },
] as const;

export type MunicipalityLevel = {
  code: string;
  level: number;
  firstOn: string;
  lastOn: string;
};

// 緯度経度 → 市区町村コード（lib/geo/municipalities.ts の lookupMunicipality）
export type MunicipalityLookup = (
  lat: number,
  lng: number,
  options?: { allowNearest?: boolean },
) => string | null;

const VISIT_MINUTES = 15;
// 軌跡が無い古いファイルでは、移動の始点と終点を直線で結び、この間隔で点を打って「通過」を近似する
const FALLBACK_STEP_KM = 1;
// 直線で近似するのは陸の移動だけ（飛行機・船は海の上を通るので除く）
const GROUND_MODES = new Set([
  "walk",
  "bicycle",
  "car",
  "bus",
  "train",
  "other",
]);

function staysOver3am(start: string, end: string): boolean {
  const from = Date.parse(start);
  const to = Date.parse(end);
  // 開始から 1 時間ずつ進めて、日本時間の 3 時台に入るか調べる（滞在は長くても数日）
  for (let t = from; t <= to; t += 60 * 60 * 1000) {
    const hour = Number(
      new Date(t).toLocaleString("en-US", {
        timeZone: "Asia/Tokyo",
        hour: "numeric",
        hourCycle: "h23",
      }),
    );
    if (hour === 3) return true;
  }
  return false;
}

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111.2;
}

export function computeMunicipalityLevels(
  segments: TimelineSegment[],
  paths: DayPath[],
  lookup: MunicipalityLookup,
): MunicipalityLevel[] {
  const result = new Map<string, MunicipalityLevel>();
  const add = (code: string | null, level: number, on: string) => {
    if (!code) return;
    const prev = result.get(code);
    if (!prev) {
      result.set(code, { code, level, firstOn: on, lastOn: on });
      return;
    }
    prev.level = Math.max(prev.level, level);
    if (on < prev.firstOn) prev.firstOn = on;
    if (on > prev.lastOn) prev.lastOn = on;
  };
  // 同じあたりの点を何度も調べないよう、約 100m 単位でまとめて覚えておく
  const cache = new Map<string, string | null>();
  const find = (lat: number, lng: number, allowNearest: boolean) => {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)},${allowNearest}`;
    if (!cache.has(key)) cache.set(key, lookup(lat, lng, { allowNearest }));
    return cache.get(key) ?? null;
  };

  for (const s of segments) {
    if (s.kind !== "visit") continue;
    const code = find(s.location.lat, s.location.lng, true);
    const minutes = (Date.parse(s.end) - Date.parse(s.start)) / 60_000;
    const level = s.isHome
      ? 5
      : staysOver3am(s.start, s.end)
        ? 4
        : minutes >= VISIT_MINUTES
          ? 3
          : 2;
    add(code, level, toJstDate(s.start));
    if (level >= 4) add(code, level, toJstDate(s.end));
  }

  if (paths.length > 0) {
    for (const path of paths) {
      for (const [lat, lng] of path.points)
        add(find(lat, lng, false), 1, path.on);
    }
  } else {
    for (const s of segments) {
      if (s.kind !== "activity" || !GROUND_MODES.has(s.mode)) continue;
      const km = roughKm(s.from.lat, s.from.lng, s.to.lat, s.to.lng);
      const steps = Math.ceil(km / FALLBACK_STEP_KM);
      for (let i = 1; i < steps; i++) {
        const lat = s.from.lat + ((s.to.lat - s.from.lat) * i) / steps;
        const lng = s.from.lng + ((s.to.lng - s.from.lng) * i) / steps;
        add(find(lat, lng, false), 1, toJstDate(s.start));
      }
    }
  }

  return [...result.values()].sort((a, b) => a.code.localeCompare(b.code));
}
