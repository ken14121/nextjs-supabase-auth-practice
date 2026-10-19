// MapLibre GL JS（v6）は、地図の計算を別スレッド（Web Worker）で動かすために
// 自分のファイル（maplibre-gl-worker.mjs）を後から読みにいく。
// Next.js のバンドルにはこのファイルが入らないので、public/maplibre/ にコピーして配信する。
// yarn install のたびに自動で実行される（package.json の postinstall）。
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/package.json"));
const outDir = join(import.meta.dirname, "..", "public", "maplibre");

mkdirSync(outDir, { recursive: true });
// worker は shared を import しているので、2 つともコピーする
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, "dist", file), join(outDir, file));
}
console.log("MapLibre の worker を public/maplibre/ にコピーしました");
