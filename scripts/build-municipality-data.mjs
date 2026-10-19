// 市区町村の境界データを、アプリで使う形にまとめるスクリプト（一度だけ手で動かす）。
//
// 元データ: スマートニュース メディア研究所「japan-topography」
//   https://github.com/smartnews-smri/japan-topography
//   （国土数値情報 行政区域データ（国土交通省）2021 年版を加工したもの）
//   - data/municipality/topojson/s0010/N03-21_XX_210101.json（都道府県ごと、点を 1% に間引いたもの）→ 判定用
//   - data/municipality/topojson/s0001/N03-21_210101.json（全国、0.1%）→ 全国の地図の表示用
//
// 使い方: node scripts/build-municipality-data.mjs <s0010 を置いたフォルダ> <全国 s0001 のファイル>
// 出力: lib/geo/data/municipalities-lookup.topo.json と municipalities-display.topo.json
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, nationalPath] = process.argv.slice(2);
if (!dir || !nationalPath) {
  console.error(
    "使い方: node scripts/build-municipality-data.mjs <s0010 のフォルダ> <s0001 の全国ファイル>",
  );
  process.exit(1);
}

// 使う属性だけに減らす（c = 市区町村コード 5 桁、n = 名前）
function slim(topology) {
  const [key] = Object.keys(topology.objects);
  const object = topology.objects[key];
  return {
    ...topology,
    objects: {
      municipalities: {
        ...object,
        geometries: object.geometries
          .filter((g) => g.properties?.N03_007)
          .map((g) => ({
            ...g,
            properties: {
              c: g.properties.N03_007,
              n: [g.properties.N03_003, g.properties.N03_004]
                .filter(Boolean)
                .join(""),
            },
          })),
      },
    },
  };
}

const lookup = {};
for (let i = 1; i <= 47; i++) {
  const pref = String(i).padStart(2, "0");
  lookup[pref] = slim(
    JSON.parse(readFileSync(join(dir, `${pref}.json`), "utf8")),
  );
}
writeFileSync(
  "lib/geo/data/municipalities-lookup.topo.json",
  JSON.stringify(lookup),
);
writeFileSync(
  "lib/geo/data/municipalities-display.topo.json",
  JSON.stringify(slim(JSON.parse(readFileSync(nationalPath, "utf8")))),
);
console.log("done");
