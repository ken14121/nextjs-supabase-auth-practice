# nextjs-supabase-auth-practice
Next.js 16 + Supabase で Google ログイン付き Web アプリを作る学習用リポジトリ

進め方は [学習ロードマップ](docs/ROADMAP.md) を参照。

## データの出典

- 都道府県の境界: [地球地図日本](https://www.gsi.go.jp/kankyochiri/gm_jpn.html)（国土地理院）を [dataofjapan/land](https://github.com/dataofjapan/land) が TopoJSON に変換したもの（`lib/geo/data/japan-prefectures.topo.json`）
- 国の境界: [Natural Earth](https://www.naturalearthdata.com/)（[world-atlas](https://github.com/topojson/world-atlas) パッケージ）
