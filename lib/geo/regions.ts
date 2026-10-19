import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopologyJson from "world-atlas/countries-50m.json";
import japanTopologyJson from "./data/japan-prefectures.topo.json";

// 緯度経度から「どの都道府県・国か」を判定する（サーバー専用。境界データが大きいため）。
//
// 境界データの出典
//   都道府県: 地球地図日本（国土地理院）を dataofjapan/land が TopoJSON に変換したもの
//   国: Natural Earth（world-atlas パッケージ）

type Area = {
  code: string;
  box: [number, number, number, number];
  shape: Feature<Polygon | MultiPolygon>;
};

// 境界データは粗く簡略化されているため、海沿い・埋め立て地・小さな島の点が
// どの形にも入らないことがある。その場合はこの距離以内で一番近い地域を使う
const NEAREST_FALLBACK_KM = 15;

let cache: { prefectures: Area[]; countries: Area[] } | null = null;

function toAreas(
  topology: Topology,
  objectName: string,
  codeOf: (geometry: {
    id?: string | number;
    properties?: Record<string, unknown>;
  }) => string | null,
): Area[] {
  const object = topology.objects[objectName] as GeometryCollection;
  const areas: Area[] = [];
  for (const geometry of object.geometries) {
    const code = codeOf(geometry);
    if (!code) continue;
    const shape = feature(topology, geometry) as Feature<
      Polygon | MultiPolygon
    >;
    if (!shape.geometry) continue;
    areas.push({
      code,
      box: bbox(shape) as [number, number, number, number],
      shape,
    });
  }
  return areas;
}

function loadAreas() {
  if (cache) return cache;
  const prefectures = toAreas(
    japanTopologyJson as unknown as Topology,
    "japan",
    (g) => {
      const id = Number(g.properties?.id);
      return id >= 1 && id <= 47 ? `JP-${String(id).padStart(2, "0")}` : null;
    },
  );
  const worldAreas = toAreas(
    worldTopologyJson as unknown as Topology,
    "countries",
    (g) =>
      g.id === undefined ? null : (countries.numericToAlpha2(g.id) ?? null),
  );
  cache = { prefectures, countries: worldAreas };
  return cache;
}

function inBox(
  box: [number, number, number, number],
  lng: number,
  lat: number,
  margin = 0,
) {
  return (
    lng >= box[0] - margin &&
    lng <= box[2] + margin &&
    lat >= box[1] - margin &&
    lat <= box[3] + margin
  );
}

function findContaining(areas: Area[], lng: number, lat: number) {
  return areas.find(
    (a) => inBox(a.box, lng, lat) && booleanPointInPolygon([lng, lat], a.shape),
  );
}

// 境界線の頂点のうち一番近いものまでの距離（km）で、近くの地域を探す
function findNearest(areas: Area[], lng: number, lat: number) {
  const marginDeg = NEAREST_FALLBACK_KM / 90; // 大まかに km → 度
  let best: { area: Area; km: number } | null = null;
  for (const area of areas) {
    if (!inBox(area.box, lng, lat, marginDeg)) continue;
    const polygons =
      area.shape.geometry.type === "Polygon"
        ? [area.shape.geometry.coordinates]
        : area.shape.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (const [pLng, pLat] of ring as Position[]) {
          const km = roughKm(lat, lng, pLat, pLng);
          if (km <= NEAREST_FALLBACK_KM && (!best || km < best.km)) {
            best = { area, km };
          }
        }
      }
    }
  }
  return best?.area;
}

function roughKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * 111.2;
}

// 例: 東京駅 → "JP-13"、ニューヨーク → "US"、海の上など不明 → null
export function lookupRegion(lat: number, lng: number): string | null {
  const { prefectures, countries: worldAreas } = loadAreas();

  const prefecture =
    findContaining(prefectures, lng, lat) ?? findNearest(prefectures, lng, lat);
  if (prefecture) return prefecture.code;

  const country =
    findContaining(worldAreas, lng, lat) ?? findNearest(worldAreas, lng, lat);
  return country?.code ?? null;
}
