import {
  type GeoPermissibleObjects,
  geoCentroid,
  geoMercator,
  geoPath,
} from "d3-geo";
import type {
  Feature,
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
import worldTopology110 from "world-atlas/countries-110m.json";
import japanTopologyJson from "./data/japan-prefectures.topo.json";

// 地図の形（SVG の path）をサーバーで作る。ブラウザに地理データのライブラリを送らずに済む。

export type Shape = { code: string; d: string };

export const JAPAN_SIZE = { width: 800, height: 800 } as const;
// 沖縄県は本土から離れているので、左上の枠の中に別の縮尺で描く
export const OKINAWA_INSET = { x: 16, y: 16, width: 300, height: 190 } as const;

// 境界データを点の数で 92% ほど間引いて軽くする（全国の地図で約 70KB）
const JAPAN_SIMPLIFY_QUANTILE = 0.08;

type GeometryWithMeta = {
  id?: string | number;
  properties?: Record<string, unknown>;
};

let japanCache: Shape[] | null = null;

function prefectureCode(g: GeometryWithMeta): string | null {
  const id = Number(g.properties?.id);
  return id >= 1 && id <= 47 ? `JP-${String(id).padStart(2, "0")}` : null;
}

export function getJapanShapes(): Shape[] {
  if (japanCache) return japanCache;

  // presimplify は渡したデータを書き換えるので、コピーしてから使う
  const base = presimplify(
    structuredClone(japanTopologyJson) as unknown as Topology<
      Record<string, GeometryCollection>
    >,
  );
  const topology = simplify(base, quantile(base, JAPAN_SIMPLIFY_QUANTILE));
  const geometries = (topology.objects.japan as GeometryCollection).geometries;

  // 本土（北海道〜九州）が収まる範囲に合わせる。小笠原・沖縄などは枠の外に出る
  const mainlandFrame: Feature<Geometry> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [128.6, 30.9],
        [145.9, 45.6],
      ],
    },
  };
  const mainland = geoPath(
    geoMercator().fitExtent(
      [
        [16, 16],
        [JAPAN_SIZE.width - 16, JAPAN_SIZE.height - 16],
      ],
      mainlandFrame,
    ),
  ).digits(1);

  const okinawaGeometry = geometries.find((g) => prefectureCode(g) === "JP-47");
  const okinawaFeature = okinawaGeometry
    ? (feature(topology, okinawaGeometry) as Feature<Geometry>)
    : null;
  // 沖縄本島〜八重山の範囲に合わせる（遠い大東諸島まで入れると島が小さくなりすぎるため。枠の外は描かない）
  const okinawaFrame: Feature<Geometry> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [123.6, 24.0],
        [128.4, 27.0],
      ],
    },
  };
  const inset = okinawaFeature
    ? geoPath(
        geoMercator().fitExtent(
          [
            [OKINAWA_INSET.x + 12, OKINAWA_INSET.y + 28],
            [
              OKINAWA_INSET.x + OKINAWA_INSET.width - 12,
              OKINAWA_INSET.y + OKINAWA_INSET.height - 12,
            ],
          ],
          okinawaFrame,
        ),
      ).digits(1)
    : null;

  const shapes: Shape[] = [];
  for (const geometry of geometries) {
    const code = prefectureCode(geometry);
    if (!code) continue;
    const shape = feature(topology, geometry) as Feature<Geometry>;
    const draw = code === "JP-47" && inset ? inset : mainland;
    const d = draw(shape);
    if (d) shapes.push({ code, d });
  }
  japanCache = shapes;
  return shapes;
}

// 小さな国の中心（経度・緯度）。地球儀の上に点を打つのに使う
export function getWorldCentroid(code: string): [number, number] | null {
  const topology = worldTopology50 as unknown as Topology;
  const geometry = (
    topology.objects.countries as GeometryCollection
  ).geometries.find(
    (g) => g.id !== undefined && countries.numericToAlpha2(g.id) === code,
  );
  if (!geometry) return null;
  const [lng, lat] = geoCentroid(
    feature(topology, geometry) as GeoPermissibleObjects,
  );
  return [Math.round(lng * 100) / 100, Math.round(lat * 100) / 100];
}

export type GlobeCountry = {
  code: string;
  geometry: Polygon | MultiPolygon;
};

let globeCache: GlobeCountry[] | null = null;

// 地球儀（ブラウザで回す）に使う国の形。投影はブラウザでするので、経度・緯度のまま渡す。
// 粗い世界地図（110m）を、小数 2 桁（約 1km）に丸めて軽くする
export function getGlobeCountries(): GlobeCountry[] {
  if (globeCache) return globeCache;
  const topology = worldTopology110 as unknown as Topology;
  const round = (ring: Position[]) =>
    ring.map(([lng, lat]) => [
      Math.round(lng * 100) / 100,
      Math.round(lat * 100) / 100,
    ]);
  const result: GlobeCountry[] = [];
  for (const geometry of (topology.objects.countries as GeometryCollection)
    .geometries) {
    if (geometry.id === undefined) continue;
    const code = countries.numericToAlpha2(geometry.id);
    if (!code) continue;
    const g = (feature(topology, geometry) as Feature<Geometry>).geometry;
    if (g.type === "Polygon") {
      result.push({
        code,
        geometry: { type: "Polygon", coordinates: g.coordinates.map(round) },
      });
    } else if (g.type === "MultiPolygon") {
      result.push({
        code,
        geometry: {
          type: "MultiPolygon",
          coordinates: g.coordinates.map((p) => p.map(round)),
        },
      });
    }
  }
  globeCache = result;
  return result;
}
