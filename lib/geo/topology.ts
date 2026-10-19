import type { Position } from "geojson";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { GeometryCollection, Topology } from "topojson-specification";
import worldTopology50 from "world-atlas/countries-50m.json";
import japanTopologyJson from "./data/japan-prefectures.topo.json";

// 地球儀に載せる形（行った県・国、線の地球儀の国境・海岸線）で共通に使う、点を減らす・丸める処理

export type AnyTopology = Topology<Record<string, GeometryCollection>>;
const simplifiedCache = new Map<string, AnyTopology>();

// 点の数を減らした TopoJSON を返す（key ごとに 1 回だけ計算する）。
// q は topojson-simplify の quantile。小さいほど粗く軽い
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
export function roundRing(ring: Position[]): Position[] {
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

// 点の数をどれだけ残すか。3D では 2D の地図（0.08）より拡大して見るので、少し細かく残す
const JAPAN_SIMPLIFY_QUANTILE = 0.15;
const WORLD_SIMPLIFY_QUANTILE = 0.2;

// 都道府県（objects.japan、properties.id が県番号）
export const japanTopology = () =>
  simplified("japan", japanTopologyJson, JAPAN_SIMPLIFY_QUANTILE);

// 世界の国（objects.countries、id が ISO 3166 の数字コード）
export const worldTopology = () =>
  simplified("world", worldTopology50, WORLD_SIMPLIFY_QUANTILE);
