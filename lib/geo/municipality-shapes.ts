import { geoArea, geoMercator, geoPath } from "d3-geo";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import displayData from "./data/municipalities-display.topo.json";
import lookupData from "./data/municipalities-lookup.topo.json";

// 市区町村の地図の形（SVG の path）をサーバーで作る。
//   全国：点を 0.1% に間引いた全国のデータ（/geo/municipalities で静的なファイルとして配る）
//   都道府県ごと：判定にも使う 1% のデータ（拡大して見る用）

export type MunicipalityShape = { c: string; n: string; d: string };
export type MunicipalityShapes = {
  width: number;
  height: number;
  shapes: MunicipalityShape[];
};

type Props = { c: string; n: string };

function features(topology: Topology) {
  const object = topology.objects.municipalities as GeometryCollection;
  return object.geometries.flatMap((g) => {
    const f = feature(topology, g) as Feature<Polygon | MultiPolygon, Props>;
    if (!f.geometry || !f.properties?.c) return [];
    // 向きが逆の形は「地球全体から自分を引いた形」になってしまうので、輪の向きを直す
    if (geoArea(f) > 2 * Math.PI) {
      const g2 = f.geometry;
      if (g2.type === "Polygon") {
        g2.coordinates = g2.coordinates.map((r) => [...r].reverse());
      } else {
        g2.coordinates = g2.coordinates.map((p) =>
          p.map((r) => [...r].reverse()),
        );
      }
    }
    return [f];
  });
}

function toShapes(
  list: Feature<Polygon | MultiPolygon, Props>[],
  width: number,
  height: number,
  // 地図に収める範囲（[経度, 緯度] の 2 点。多角形だと向きで意味が変わるので点で渡す）
  frame: [[number, number], [number, number]] | null,
): MunicipalityShapes {
  const projection = geoMercator().fitExtent(
    [
      [6, 6],
      [width - 6, height - 6],
    ],
    frame
      ? { type: "MultiPoint", coordinates: frame }
      : { type: "FeatureCollection", features: list },
  );
  const path = geoPath(projection).digits(1);
  return {
    width,
    height,
    shapes: list.flatMap((f) => {
      const d = path(f);
      return d ? [{ c: f.properties.c, n: f.properties.n, d }] : [];
    }),
  };
}

let national: MunicipalityShapes | null = null;

// 全国（北海道〜九州が収まる範囲。沖縄・小笠原は枠の外）
export function getNationalMunicipalityShapes(): MunicipalityShapes {
  national ??= toShapes(
    features(displayData as unknown as Topology).filter(
      (f) => !f.properties.c.startsWith("47"),
    ),
    600,
    640,
    [
      [129.3, 30.9],
      [146, 45.6],
    ],
  );
  return national;
}

const byPrefecture = new Map<string, MunicipalityShapes>();

// 都道府県ごと（"13" = 東京都）。東京都は島が遠いので、本土（区部・多摩）に合わせる
export function getPrefectureMunicipalityShapes(
  pref: string,
): MunicipalityShapes | null {
  const cached = byPrefecture.get(pref);
  if (cached) return cached;
  const topology = (lookupData as unknown as Record<string, Topology>)[pref];
  if (!topology) return null;
  const list = features(topology);
  const frames: Record<string, [[number, number], [number, number]]> = {
    "13": [
      [138.9, 35.45],
      [139.95, 35.9],
    ],
  };
  const shapes = toShapes(list, 600, 600, frames[pref] ?? null);
  byPrefecture.set(pref, shapes);
  return shapes;
}
