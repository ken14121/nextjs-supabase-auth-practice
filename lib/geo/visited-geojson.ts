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
import { isPrefectureCode, regionName } from "./names";
import { japanTopology, roundRing, worldTopology } from "./topology";
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
  const topology = japanTopology();
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
  const topology = worldTopology();
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
