import type { Feature, MultiLineString } from "geojson";
import type {
  ExpressionSpecification,
  LayerSpecification,
  SkySpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { BINS } from "@/lib/geo/visited-colors";
import type { VisitedFeatures } from "@/lib/geo/visited-geojson";
import { GSI_DEM_PROTOCOL } from "./gsi-dem";

// 地球儀の見た目（スタイル）。「写真」と「線（白・黒）」の 3 種類を、同じ関数から作る。
// 見た目を切り替えるときは、新しいスタイルとの差分だけを地図に当てる（map.setStyle の diff）

export type Look = "photo" | "light" | "dark";

export const LOOKS: { value: Look; label: string }[] = [
  { value: "photo", label: "写真" },
  { value: "light", label: "線・白" },
  { value: "dark", label: "線・黒" },
];

// 3D 都市モデル（PLATEAU）の建物。2023 年公開の 211 都市分を 1 つの PMTiles にまとめたもの
export const PLATEAU_URL =
  "https://shi-works.com/pmtiles/plateau/PLATEAU_2023_LOD0.pmtiles";

const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>';
const PLATEAU_ATTRIBUTION =
  '<a href="https://www.mlit.go.jp/plateau/" target="_blank" rel="noreferrer">3D都市モデル PLATEAU（国土交通省）</a>（Pacific Spatial Solutions・shi-works 加工、CC BY 4.0）';

// 標高タイルがあるのは日本の周りだけなので、その範囲だけ読みにいく
const JAPAN_BOUNDS: [number, number, number, number] = [122, 20, 154, 46];

// 線の地球儀の色。線は 1 色（ink）だけ、行った場所だけを差し色（accent）にする
type LineTheme = {
  // 地球の外（宇宙）
  space: string;
  // 地球の表面
  globe: string;
  ink: string;
  accent: string;
  // 建物は低いほど地面に近い色、高いほど濃くする
  buildingLow: string;
  buildingHigh: string;
};

const LINE_THEMES: Record<Exclude<Look, "photo">, LineTheme> = {
  light: {
    space: "#e6e3dc",
    globe: "#fbfaf7",
    ink: "#1d1c1a",
    accent: "#d1462f",
    buildingLow: "#ffffff",
    buildingHigh: "#b9b5ad",
  },
  dark: {
    space: "#000000",
    globe: "#0f0f10",
    ink: "#ebe7de",
    accent: "#d6a84b",
    buildingLow: "#3a3a3d",
    buildingHigh: "#a19d95",
  },
};

const PHOTO_SPACE = "#050b18";

// 地球の外側の色（地図を入れている箱の背景）
export function spaceColor(look: Look): string {
  return look === "photo" ? PHOTO_SPACE : LINE_THEMES[look].space;
}

// 凡例に出す、行った日数ごとの色（線の地球儀では差し色の濃さで表す）
export function legendFor(look: Look): { label: string; color: string }[] {
  if (look === "photo") {
    return BINS.map((bin) => ({ label: bin.label, color: bin.fill }));
  }
  const { accent } = LINE_THEMES[look];
  return BINS.map((bin, i) => ({
    label: bin.label,
    color: `color-mix(in srgb, ${accent} ${Math.round(ACCENT_OPACITY[i] * 100)}%, transparent)`,
  }));
}

// 行った日数で色を変える（2D の地図と同じ段階）
const fillByDays: ExpressionSpecification = [
  "step",
  ["get", "days"],
  BINS[0].fill,
  BINS[1].min,
  BINS[1].fill,
  BINS[2].min,
  BINS[2].fill,
  BINS[3].min,
  BINS[3].fill,
];

// 線の地球儀では、差し色 1 色の濃さで日数を表す
const ACCENT_OPACITY = [0.25, 0.4, 0.58, 0.78] as const;
const accentOpacityByDays: ExpressionSpecification = [
  "step",
  ["get", "days"],
  ACCENT_OPACITY[0],
  BINS[1].min,
  ACCENT_OPACITY[1],
  BINS[2].min,
  ACCENT_OPACITY[2],
  BINS[3].min,
  ACCENT_OPACITY[3],
];

// 緯線・経線（15 度ごと）。地球儀の上で曲線になるよう、2 度ごとに点を打つ。
// 経線は極の近くで 1 点に集まって黒く潰れるので、緯度 80 度で止める
const range = (from: number, to: number, step: number) =>
  Array.from(
    { length: Math.floor((to - from) / step) + 1 },
    (_, i) => from + i * step,
  );
const GRATICULE: Feature<MultiLineString> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiLineString",
    coordinates: [
      ...range(-180, 165, 15).map((lng) =>
        range(-80, 80, 2).map((lat) => [lng, lat]),
      ),
      ...range(-75, 75, 15).map((lat) =>
        range(-180, 180, 2).map((lng) => [lng, lat]),
      ),
    ],
  },
};

export type PlateauMeta = {
  // PMTiles の中のレイヤー名と、建物の高さが入っている項目名
  layerId: string;
  heightField: string | null;
  // 建物のデータがある一番引いたズーム。ここから建物を伸ばし始める
  minZoom: number;
};

// 近づくと建物が地面から伸びてくるように、ズームに合わせて高さを 0 → 本来の高さにする。
// PLATEAU のデータはズーム 16 の 1 段だけなので、そこから少しのあいだで伸ばしきる
const GROW_ZOOMS = 0.6;

// 建物が本来の高さまで伸びきるズーム
export const buildingsFullZoom = (plateau: PlateauMeta) =>
  plateau.minZoom + GROW_ZOOMS;

function buildingLayer(plateau: PlateauMeta, look: Look): LayerSpecification {
  // 高さが分からない建物は 10m、低すぎる値（欠けたデータ）は 3m として立てる
  const height: ExpressionSpecification = plateau.heightField
    ? [
        "max",
        ["to-number", ["coalesce", ["get", plateau.heightField], 10], 10],
        3,
      ]
    : ["literal", 10];
  const color: ExpressionSpecification =
    look === "photo"
      ? // 高い建物ほど少し青みがかった色にする
        [
          "interpolate",
          ["linear"],
          height,
          0,
          "#ece8df",
          60,
          "#d4dde8",
          200,
          "#a9c3e2",
        ]
      : [
          "interpolate",
          ["linear"],
          height,
          0,
          LINE_THEMES[look].buildingLow,
          150,
          LINE_THEMES[look].buildingHigh,
        ];
  return {
    id: "plateau-buildings",
    type: "fill-extrusion",
    source: "plateau",
    "source-layer": plateau.layerId,
    paint: {
      "fill-extrusion-color": color,
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["zoom"],
        plateau.minZoom,
        0,
        buildingsFullZoom(plateau),
        height,
      ],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": look === "photo" ? 0.92 : 0.96,
    },
  };
}

function skyFor(look: Look): SkySpecification {
  if (look !== "photo") {
    // 線の地球儀では大気の光を出さない（輪郭をくっきり見せる）
    return { "atmosphere-blend": 0 };
  }
  return {
    // 引きで見たときは地球のまわりを大気の光で包み、近づくと消す
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
    "sky-color": "#7cb3eb",
    "horizon-color": "#dcebf8",
    "fog-color": "#eef4fa",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.8,
  };
}

// 地球儀で見ているあいだは国を塗り、日本に近づくと県に切り替える
const countryOpacity = (base: number | ExpressionSpecification) =>
  [
    "interpolate",
    ["linear"],
    ["zoom"],
    3,
    base,
    4.2,
    0,
  ] as ExpressionSpecification;

function photoLayers(): LayerSpecification[] {
  return [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0b1a2e" },
    },
    { id: "photo", type: "raster", source: "photo" },
    {
      id: "visited-countries",
      type: "fill",
      source: "countries",
      maxzoom: 5,
      paint: { "fill-color": fillByDays, "fill-opacity": countryOpacity(0.6) },
    },
    {
      id: "visited-prefectures",
      type: "fill",
      source: "prefectures",
      minzoom: 3,
      maxzoom: 14,
      paint: {
        "fill-color": fillByDays,
        // 拡大するほど薄くして、写真と地形が見えるようにする
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.2,
          0,
          4.2,
          0.55,
          8,
          0.45,
          11,
          0.15,
          13.5,
          0,
        ],
      },
    },
    {
      id: "visited-prefectures-outline",
      type: "line",
      source: "prefectures",
      // 境界は約 100m 単位に丸めてあるので、写真とずれが目立つほど拡大したら消す
      minzoom: 3,
      maxzoom: 13.5,
      paint: {
        "line-color": "#ffffff",
        "line-width": 1,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.2,
          0,
          4.5,
          0.9,
          10,
          0.6,
          13.5,
          0,
        ],
      },
    },
  ];
}

function lineLayers(theme: LineTheme): LayerSpecification[] {
  return [
    {
      id: "background",
      type: "background",
      paint: { "background-color": theme.globe },
    },
    {
      // 山の陰影をうっすら付ける（日本の周りだけ）
      id: "hillshade",
      type: "hillshade",
      source: "hillshade",
      minzoom: 5,
      paint: {
        "hillshade-shadow-color": theme.ink,
        "hillshade-highlight-color": theme.globe,
        "hillshade-accent-color": theme.ink,
        "hillshade-exaggeration": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          0,
          7,
          0.25,
        ],
      },
    },
    {
      id: "visited-countries",
      type: "fill",
      source: "countries",
      maxzoom: 5,
      paint: {
        "fill-color": theme.accent,
        "fill-opacity": countryOpacity(accentOpacityByDays),
      },
    },
    {
      id: "visited-prefectures",
      type: "fill",
      source: "prefectures",
      minzoom: 3,
      maxzoom: 14,
      paint: {
        "fill-color": theme.accent,
        "fill-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.2,
          0,
          4.2,
          accentOpacityByDays,
          10,
          ["*", accentOpacityByDays, 0.5],
          13.5,
          0,
        ],
      },
    },
    {
      id: "graticule",
      type: "line",
      source: "graticule",
      maxzoom: 8,
      paint: {
        "line-color": theme.ink,
        "line-width": 0.5,
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.18, 8, 0],
      },
    },
    {
      id: "borders",
      type: "line",
      source: "outlines",
      filter: ["==", ["get", "kind"], "border"],
      paint: {
        "line-color": theme.ink,
        "line-width": 0.6,
        "line-opacity": 0.55,
        "line-dasharray": [3, 2],
      },
    },
    {
      id: "pref-borders",
      type: "line",
      source: "outlines",
      filter: ["==", ["get", "kind"], "pref-border"],
      minzoom: 3.5,
      maxzoom: 13.5,
      paint: {
        "line-color": theme.ink,
        "line-width": 0.6,
        "line-dasharray": [2, 2],
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3.5,
          0,
          5,
          0.5,
          12,
          0.35,
          13.5,
          0,
        ],
      },
    },
    {
      id: "coast",
      type: "line",
      source: "outlines",
      filter: ["in", ["get", "kind"], ["literal", ["coast", "jp-coast"]]],
      paint: {
        "line-color": theme.ink,
        "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.7, 6, 1.3],
        "line-opacity": 0.9,
      },
    },
  ];
}

const demTiles = [
  `${GSI_DEM_PROTOCOL}://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`,
];

export function buildStyle({
  visited,
  look,
  plateau,
}: {
  visited: { prefectures: VisitedFeatures; countries: VisitedFeatures };
  look: Look;
  plateau: PlateauMeta | null;
}): StyleSpecification {
  const sources: Record<string, SourceSpecification> = {
    terrain: {
      type: "raster-dem",
      tiles: demTiles,
      encoding: "terrarium",
      tileSize: 256,
      minzoom: 1,
      maxzoom: 14,
      bounds: JAPAN_BOUNDS,
      attribution: GSI_ATTRIBUTION,
    },
    countries: { type: "geojson", data: visited.countries },
    prefectures: { type: "geojson", data: visited.prefectures },
  };
  if (look === "photo") {
    sources.photo = {
      type: "raster",
      tiles: [
        "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
      ],
      tileSize: 256,
      minzoom: 2,
      maxzoom: 18,
      attribution: GSI_ATTRIBUTION,
    };
  } else {
    // 陰影には地形（terrain）とは別のソースを使う（同じソースだと MapLibre の描画が粗くなる）
    sources.hillshade = { ...sources.terrain };
    sources.graticule = { type: "geojson", data: GRATICULE };
    // 海岸線・国境・県境。ビルド時に作った静的なファイル（app/geo/outlines/route.ts）
    sources.outlines = { type: "geojson", data: "/geo/outlines" };
  }

  const layers =
    look === "photo" ? photoLayers() : lineLayers(LINE_THEMES[look]);
  if (plateau) {
    sources.plateau = {
      type: "vector",
      url: `pmtiles://${PLATEAU_URL}`,
      attribution: PLATEAU_ATTRIBUTION,
    };
    layers.push(buildingLayer(plateau, look));
  }

  return {
    version: 8,
    projection: { type: "globe" },
    sky: skyFor(look),
    sources,
    layers,
    terrain: { source: "terrain", exaggeration: 1.5 },
  };
}
