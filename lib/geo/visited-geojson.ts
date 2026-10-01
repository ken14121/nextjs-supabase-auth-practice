import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopology50 from "world-atlas/countries-50m.json";
import japanTopologyJson from "./data/japan-prefectures.topo.json";
import { isPrefectureCode, regionName } from "./names";
import type { VisitedRegion } from "./visited-colors";

// 3D 地球儀に重ねる「行った県・国」の形を GeoJSON で作る（サーバー専用）。
// 行った場所の形だけを送るので、ブラウザに届くデータは小さい。

export type VisitedProperties = {
  code: string;
  name: string;
  days: number;
  first: string;
  last: string;
};

export type VisitedFeatures = FeatureCollection<
  Polygon | MultiPolygon,
  VisitedProperties
>;

// 点の数をどれだけ残すか（topojson-simplify の quantile。小さいほど粗く軽い）。
// 3D では 2D の地図（0.08）より拡大して見るので、少し細かく残す
const JAPAN_SIMPLIFY_QUANTILE = 0.15;
const WORLD_SIMPLIFY_QUANTILE = 0.2;

type AnyTopology = Topology<Record<string, GeometryCollection>>;
const simplifiedCache = new Map<string, AnyTopology>();

function simplified(key: string, json: unknown, q: number): AnyTopology {
  const cached = simplifiedCache.get(key);
  if (cached) return cached;
  // presimplify は渡したデータを書き換えるので、コピーしてから使う
  const base = presimplify(structuredClone(json) as AnyTopology);
  const topology = simplify(base, quantile(base, q));
  simplifiedCache.set(key, topology);
  return topology;
}

// 座標を小数 3 桁（約 100m）に丸め、丸めて同じ点になったものは省いて、送るデータを軽くする
function roundRing(ring: Position[]): Position[] {
  const result: Position[] = [];
  for (const p of ring) {
    const q: Position = [
      Math.round(p[0] * 1e3) / 1e3,
      Math.round(p[1] * 1e3) / 1e3,
    ];
    const prev = result.at(-1);
    if (prev && prev[0] === q[0] && prev[1] === q[1]) continue;
    result.push(q);
  }
  return result;
}

function roundCoordinates(geometry: Polygon | MultiPolygon) {
  // 丸めて 4 点（閉じた三角形）より少なくなった輪は形にならないので捨てる
  const rings = (polygon: Position[][]) =>
    polygon.map(roundRing).filter((r) => r.length >= 4);
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: rings(geometry.coordinates) };
  }
  return {
    ...geometry,
    coordinates: geometry.coordinates
      .map(rings)
      .filter((polygon) => polygon.length > 0),
  };
}

function toFeature(
  shape: Feature<Geometry>,
  region: VisitedRegion,
): Feature<Polygon | MultiPolygon, VisitedProperties> | null {
  const geometry = shape.geometry;
  if (geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon") {
    return null;
  }
  return {
    type: "Feature",
    properties: {
      code: region.region_code,
      name: regionName(region.region_code),
      days: region.visited_days,
      first: region.first_visited_on,
      last: region.last_visited_on,
    },
    geometry: roundCoordinates(geometry),
  };
}

function prefectureFeatures(
  visited: Map<string, VisitedRegion>,
): VisitedFeatures["features"] {
  if (visited.size === 0) return [];
  const topology = simplified(
    "japan",
    japanTopologyJson,
    JAPAN_SIMPLIFY_QUANTILE,
  );
  const result: VisitedFeatures["features"] = [];
  for (const geometry of topology.objects.japan.geometries) {
    const id = Number((geometry.properties as { id?: unknown })?.id);
    const region = visited.get(`JP-${String(id).padStart(2, "0")}`);
    if (!region) continue;
    const f = toFeature(
      feature(topology, geometry) as Feature<Geometry>,
      region,
    );
    if (f) result.push(f);
  }
  return result;
}

function countryFeatures(
  visited: Map<string, VisitedRegion>,
): VisitedFeatures["features"] {
  if (visited.size === 0) return [];
  const topology = simplified(
    "world",
    worldTopology50,
    WORLD_SIMPLIFY_QUANTILE,
  );
  const result: VisitedFeatures["features"] = [];
  for (const geometry of topology.objects.countries.geometries) {
    if (geometry.id === undefined) continue;
    const code = countries.numericToAlpha2(geometry.id);
    const region = code ? visited.get(code) : undefined;
    if (!region) continue;
    const f = toFeature(
      feature(topology, geometry) as Feature<Geometry>,
      region,
    );
    if (f) result.push(f);
  }
  return result;
}

export function getVisitedFeatures(regions: VisitedRegion[]): {
  prefectures: VisitedFeatures;
  countries: VisitedFeatures;
} {
  const prefectures = new Map<string, VisitedRegion>();
  const worldCountries = new Map<string, VisitedRegion>();
  for (const region of regions) {
    if (isPrefectureCode(region.region_code)) {
      prefectures.set(region.region_code, region);
    } else {
      worldCountries.set(region.region_code, region);
    }
  }

  // 地球儀の引きの画面では「日本」も 1 つの国として塗る。
  // 日数は県ごとの日数のうち一番多いもの（同じ日に 2 県行くと重なるので、合計はしない）
  if (prefectures.size > 0 && !worldCountries.has("JP")) {
    const list = [...prefectures.values()];
    worldCountries.set("JP", {
      region_code: "JP",
      visited_days: Math.max(...list.map((r) => r.visited_days)),
      first_visited_on: list.map((r) => r.first_visited_on).sort()[0],
      last_visited_on: list
        .map((r) => r.last_visited_on)
        .sort()
        .at(-1) as string,
    });
  }

  return {
    prefectures: {
      type: "FeatureCollection",
      features: prefectureFeatures(prefectures),
    },
    countries: {
      type: "FeatureCollection",
      features: countryFeatures(worldCountries),
    },
  };
}
