import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import lookupData from "./data/municipalities-lookup.topo.json";
import { PREFECTURES } from "./names";

// 緯度経度から「どの市区町村か」を判定する（サーバー専用。境界データが約 1.5MB あるため）。
//
// 境界データの出典
//   国土数値情報 行政区域データ（国土交通省）2021 年版を、スマートニュース メディア研究所
//   （japan-topography）が加工したもの。作り方は scripts/build-municipality-data.mjs
//
// 市区町村コードは 5 桁（上 2 桁が都道府県）。政令指定都市は区ごと（例: 13101 千代田区、14101 横浜市鶴見区）

type Municipality = {
  code: string;
  name: string;
  box: [number, number, number, number];
  shape: Feature<Polygon | MultiPolygon>;
};

// 海沿いや埋め立て地の滞在は、簡略化した境界からはみ出すことがある。
// その場合はこの距離以内で一番近い市区町村にする（通過の点には使わない）
const NEAREST_FALLBACK_KM = 3;
// 近くの市区町村だけを調べるための、地図のマス（約 10km 四方）
const CELL_DEG = 0.1;

type Index = {
  list: Municipality[];
  byCode: Map<string, Municipality>;
  cells: Map<string, Municipality[]>;
};
let cache: Index | null = null;

const cellKey = (lng: number, lat: number) =>
  `${Math.floor(lng / CELL_DEG)},${Math.floor(lat / CELL_DEG)}`;

function load(): Index {
  if (cache) return cache;
  const list: Municipality[] = [];
  for (const topology of Object.values(
    lookupData as unknown as Record<string, Topology>,
  )) {
    const object = topology.objects.municipalities as GeometryCollection;
    for (const geometry of object.geometries) {
      const shape = feature(topology, geometry) as Feature<
        Polygon | MultiPolygon
      >;
      const props = geometry.properties as { c?: string; n?: string } | null;
      if (!shape.geometry || !props?.c) continue;
      list.push({
        code: props.c,
        name: props.n ?? "",
        box: bbox(shape) as [number, number, number, number],
        shape,
      });
    }
  }
  // 境界の箱が重なるマスに登録しておく（調べるときは、点のマスにある市区町村だけ見る）
  const cells = new Map<string, Municipality[]>();
  for (const m of list) {
    const [x0, y0, x1, y1] = m.box;
    for (
      let x = Math.floor(x0 / CELL_DEG);
      x <= Math.floor(x1 / CELL_DEG);
      x++
    ) {
      for (
        let y = Math.floor(y0 / CELL_DEG);
        y <= Math.floor(y1 / CELL_DEG);
        y++
      ) {
        const key = `${x},${y}`;
        const bucket = cells.get(key) ?? [];
        bucket.push(m);
        cells.set(key, bucket);
      }
    }
  }
  // 飛び地などで同じコードが複数の形に分かれていることがあるので、名前はコードで引けるようにする
  const byCode = new Map<string, Municipality>();
  for (const m of list) if (!byCode.has(m.code)) byCode.set(m.code, m);
  cache = { list, byCode, cells };
  return cache;
}

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111.2;
}

function nearest(lat: number, lng: number): Municipality | null {
  const { cells } = load();
  const cx = Math.floor(lng / CELL_DEG);
  const cy = Math.floor(lat / CELL_DEG);
  let best: { m: Municipality; km: number } | null = null;
  const seen = new Set<Municipality>();
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const m of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
        if (seen.has(m)) continue;
        seen.add(m);
        const polygons =
          m.shape.geometry.type === "Polygon"
            ? [m.shape.geometry.coordinates]
            : m.shape.geometry.coordinates;
        for (const polygon of polygons) {
          for (const [pLng, pLat] of polygon[0] as Position[]) {
            const km = roughKm(lat, lng, pLat, pLng);
            if (km <= NEAREST_FALLBACK_KM && (!best || km < best.km)) {
              best = { m, km };
            }
          }
        }
      }
    }
  }
  return best?.m ?? null;
}

// 例: 東京駅 → "13101"（千代田区）。日本の外や海の上 → null。
// allowNearest: 境界から少しはみ出した点も、近くの市区町村にする（滞在の判定用）
export function lookupMunicipality(
  lat: number,
  lng: number,
  { allowNearest = false } = {},
): string | null {
  const bucket = load().cells.get(cellKey(lng, lat)) ?? [];
  const hit = bucket.find(
    (m) =>
      lng >= m.box[0] &&
      lng <= m.box[2] &&
      lat >= m.box[1] &&
      lat <= m.box[3] &&
      booleanPointInPolygon([lng, lat], m.shape),
  );
  if (hit) return hit.code;
  return allowNearest ? (nearest(lat, lng)?.code ?? null) : null;
}

// 市区町村の数（政令指定都市の区を 1 つずつ数える）
export function municipalityCount(): number {
  return load().byCode.size;
}

// "13101" → { prefecture: "東京都", name: "千代田区" }
export function municipalityName(code: string): {
  prefecture: string;
  name: string;
} {
  const prefecture = PREFECTURES[Number(code.slice(0, 2)) - 1] ?? "";
  return { prefecture, name: load().byCode.get(code)?.name ?? code };
}
