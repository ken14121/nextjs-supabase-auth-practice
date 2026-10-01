# nextjs-supabase-auth-practice
Next.js 16 + Supabase で Google ログイン付き Web アプリを作る学習用リポジトリ

進め方は [学習ロードマップ](docs/ROADMAP.md) を参照。

## データの出典

- 都道府県の境界: [地球地図日本](https://www.gsi.go.jp/kankyochiri/gm_jpn.html)（国土地理院）を [dataofjapan/land](https://github.com/dataofjapan/land) が TopoJSON に変換したもの（`lib/geo/data/japan-prefectures.topo.json`）
- 国の境界: [Natural Earth](https://www.naturalearthdata.com/)（[world-atlas](https://github.com/topojson/world-atlas) パッケージ）
- 3D 地球儀（`/map3d`）の航空写真・標高: [地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（シームレス空中写真・標高タイル）。標高タイルの変換に [maplibre-gl-gsi-terrain](https://github.com/mug-jp/maplibre-gl-gsi-terrain) を使用
- 3D 地球儀の建物: [3D都市モデル（Project PLATEAU）](https://www.mlit.go.jp/plateau/)（国土交通省）。Pacific Spatial Solutions が作成した LOD0 データ（CC BY 4.0）を [shiwaku/mlit-plateau-bldg-pmtiles](https://github.com/shiwaku/mlit-plateau-bldg-pmtiles) が PMTiles に変換したもの
