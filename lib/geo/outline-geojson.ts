import type { FeatureCollection, MultiLineString, Position } from "geojson";
import { mesh } from "topojson-client";
import { japanTopology, roundRing, worldTopology } from "./topology";

// 「線の地球儀」に引く線（海岸線・国境・県境）を GeoJSON で作る。
// TopoJSON の mesh は、となり合う 2 つの形の境目を 1 本の線として取り出せる
//（ふつうに輪郭を描くと、国境が両側の国から 2 回描かれてしまう）

export type OutlineKind = "coast" | "border" | "jp-coast" | "pref-border";

export type OutlineFeatures = FeatureCollection<
  MultiLineString,
  { kind: OutlineKind }
>;

// 日本の海岸線は、世界のデータより細かい都道府県のデータの方を使う
const JAPAN_NUMERIC_CODE = "392";

// 経度 180 度（日付変更線）のところで線を切る。
// Natural Earth はロシアやフィジーを 180 度で 2 つに分けているので、その切れ目に沿った線や、
// 179.9 度 → -179.9 度のように飛ぶ線ができる。そのまま描くと、地球を反対側にぐるっと一周する線になる
const ANTIMERIDIAN = 179.9;

function splitAtAntimeridian(line: Position[]): Position[][] {
  const parts: Position[][] = [];
  let current: Position[] = [];
  for (const p of line) {
    const prev = current.at(-1);
    const jumps = prev && Math.abs(p[0] - prev[0]) > 180;
    const alongCut =
      prev &&
      Math.abs(p[0]) >= ANTIMERIDIAN &&
      Math.abs(prev[0]) >= ANTIMERIDIAN;
    if (jumps || alongCut) {
      parts.push(current);
      current = [];
    }
    current.push(p);
  }
  parts.push(current);
  return parts;
}

function round(geometry: MultiLineString): MultiLineString {
  return {
    type: "MultiLineString",
    coordinates: geometry.coordinates
      .map(roundRing)
      .flatMap(splitAtAntimeridian)
      .filter((line) => line.length >= 2),
  };
}

export function getOutlineFeatures(): OutlineFeatures {
  const world = worldTopology();
  const japan = japanTopology();
  const countries = world.objects.countries;
  const prefectures = japan.objects.japan;

  const lines: [OutlineKind, MultiLineString][] = [
    // a === b：となりの国が無い線 = 海岸線
    [
      "coast",
      mesh(world, countries, (a, b) => a === b && a.id !== JAPAN_NUMERIC_CODE),
    ],
    // a !== b：2 つの国の境目 = 国境
    ["border", mesh(world, countries, (a, b) => a !== b)],
    ["jp-coast", mesh(japan, prefectures, (a, b) => a === b)],
    ["pref-border", mesh(japan, prefectures, (a, b) => a !== b)],
  ];

  return {
    type: "FeatureCollection",
    features: lines.map(([kind, geometry]) => ({
      type: "Feature",
      properties: { kind },
      geometry: round(geometry),
    })),
  };
}
