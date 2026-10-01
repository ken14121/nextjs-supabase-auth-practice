"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  type AddProtocolAction,
  AttributionControl,
  addProtocol,
  type ExpressionSpecification,
  GlobeControl,
  type LngLatLike,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type StyleSpecification,
  setWorkerUrl,
  TerrainControl,
} from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BINS } from "@/lib/geo/visited-colors";
import type { VisitedFeatures } from "@/lib/geo/visited-geojson";
import { GSI_DEM_PROTOCOL, gsiDemProtocol } from "./gsi-dem";
import { attachOrbitGestures } from "./orbit-gestures";
import { type GestureMode, ViewControls } from "./view-controls";

// 疑似 Google Earth。MapLibre GL JS で、地球儀 → 日本 → 3D の山 → 3D のビル と拡大していける地図

// 3D 都市モデル（PLATEAU）の建物。2023 年公開の 211 都市分を 1 つの PMTiles にまとめたもの
const PLATEAU_URL =
  "https://shi-works.com/pmtiles/plateau/PLATEAU_2023_LOD0.pmtiles";

const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル</a>';
const PLATEAU_ATTRIBUTION =
  '<a href="https://www.mlit.go.jp/plateau/" target="_blank" rel="noreferrer">3D都市モデル PLATEAU（国土交通省）</a>（Pacific Spatial Solutions・shi-works 加工、CC BY 4.0）';

// 標高タイルがあるのは日本の周りだけなので、その範囲だけ読みにいく
const JAPAN_BOUNDS: [number, number, number, number] = [122, 20, 154, 46];

type Place = {
  label: string;
  center: LngLatLike;
  zoom: number;
  pitch: number;
  bearing: number;
};

const PLACES: Place[] = [
  { label: "地球", center: [139, 30], zoom: 1.3, pitch: 0, bearing: 0 },
  { label: "日本", center: [137.5, 37.5], zoom: 4.3, pitch: 0, bearing: 0 },
  {
    label: "富士山",
    center: [138.73, 35.33],
    zoom: 11.6,
    pitch: 70,
    bearing: -20,
  },
  {
    label: "東京駅",
    center: [139.7671, 35.6812],
    zoom: 16.2,
    pitch: 65,
    bearing: 30,
  },
];

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

let setupDone = false;
const pmtilesProtocol = new Protocol();

function setupMapLibreOnce() {
  if (setupDone) return;
  setupDone = true;
  // 別スレッドで動く部分。yarn install 時に public/maplibre/ へコピーしたものを使う
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  // gsidem://… 地理院の標高 PNG を、MapLibre が読める形（Terrarium）に変換する
  addProtocol(GSI_DEM_PROTOCOL, gsiDemProtocol);
  // pmtiles://… 1 つの大きなファイルから、必要なタイルだけを取り出す
  // （pmtiles の型は MapLibre の型より少しゆるいので、MapLibre の型として渡す）
  addProtocol("pmtiles", pmtilesProtocol.tilev4 as AddProtocolAction);
}

function buildStyle(visited: {
  prefectures: VisitedFeatures;
  countries: VisitedFeatures;
}): StyleSpecification {
  return {
    version: 8,
    projection: { type: "globe" },
    sky: {
      // 引きで見たときは地球のまわりを大気の光で包み、近づくと消す
      "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        5,
        1,
        7,
        0,
      ],
      "sky-color": "#7cb3eb",
      "horizon-color": "#dcebf8",
      "fog-color": "#eef4fa",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.8,
    },
    sources: {
      photo: {
        type: "raster",
        tiles: [
          "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        ],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 18,
        attribution: GSI_ATTRIBUTION,
      },
      terrain: {
        type: "raster-dem",
        tiles: [
          `${GSI_DEM_PROTOCOL}://https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png`,
        ],
        encoding: "terrarium",
        tileSize: 256,
        minzoom: 1,
        maxzoom: 14,
        bounds: JAPAN_BOUNDS,
        attribution: GSI_ATTRIBUTION,
      },
      countries: { type: "geojson", data: visited.countries },
      prefectures: { type: "geojson", data: visited.prefectures },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0b1a2e" },
      },
      { id: "photo", type: "raster", source: "photo" },
      {
        // 地球儀で見ているあいだは国を塗り、日本に近づくと県に切り替える
        id: "visited-countries",
        type: "fill",
        source: "countries",
        maxzoom: 5,
        paint: {
          "fill-color": fillByDays,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 4.2, 0],
        },
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
    ],
    terrain: { source: "terrain", exaggeration: 1.5 },
  };
}

// 建物の高さが入っている項目を、PMTiles のメタデータ（項目名の一覧）から探す
function pickHeightField(fields: Record<string, string>): string | null {
  const names = Object.keys(fields);
  return (
    names.find((n) => /measured_?height/i.test(n)) ??
    names.find((n) => /height/i.test(n)) ??
    null
  );
}

type VectorLayerMeta = { id: string; fields?: Record<string, string> };

// PMTiles の中の「レイヤー名と項目名の一覧」を読む（ファイル全体ではなく先頭の一部だけ）
async function loadPlateauLayerMeta(): Promise<VectorLayerMeta | null> {
  const archive = new PMTiles(PLATEAU_URL);
  pmtilesProtocol.add(archive);
  const metadata = (await archive.getMetadata()) as {
    vector_layers?: VectorLayerMeta[];
  };
  return metadata.vector_layers?.[0] ?? null;
}

function addPlateauBuildings(map: MapLibreMap, layer: VectorLayerMeta) {
  const heightField = pickHeightField(layer.fields ?? {});
  // 高さが分からない建物は 10m、低すぎる値（欠けたデータ）は 3m として立てる
  const height: ExpressionSpecification = heightField
    ? ["max", ["to-number", ["coalesce", ["get", heightField], 10], 10], 3]
    : ["literal", 10];

  map.addSource("plateau", {
    type: "vector",
    url: `pmtiles://${PLATEAU_URL}`,
    attribution: PLATEAU_ATTRIBUTION,
  });
  map.addLayer({
    id: "plateau-buildings",
    type: "fill-extrusion",
    source: "plateau",
    "source-layer": layer.id,
    paint: {
      // 高い建物ほど少し青みがかった色にする
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        height,
        0,
        "#ece8df",
        60,
        "#d4dde8",
        200,
        "#a9c3e2",
      ],
      "fill-extrusion-height": height,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.92,
    },
  });
}

function popupContent(properties: Record<string, unknown>): HTMLElement {
  const root = document.createElement("div");
  root.className = "flex flex-col gap-0.5 text-sm text-neutral-900";
  const title = document.createElement("strong");
  title.textContent = String(properties.name);
  const days = document.createElement("span");
  days.textContent = `${properties.days}日`;
  const range = document.createElement("span");
  range.className = "text-xs text-neutral-500";
  range.textContent = `初めて ${properties.first}・最後 ${properties.last}`;
  root.append(title, days, range);
  return root;
}

export default function EarthMap({
  prefectures,
  countries,
}: {
  prefectures: VisitedFeatures;
  countries: VisitedFeatures;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [buildingsStatus, setBuildingsStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [mode, setMode] = useState<GestureMode>("pan");
  // 地図のイベントの中から、いまのモードを読むための入れ物
  const modeRef = useRef<GestureMode>("pan");

  useEffect(() => {
    if (!containerRef.current) return;
    setupMapLibreOnce();

    const start = PLACES[0];
    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle({ prefectures, countries }),
      center: start.center,
      zoom: start.zoom,
      minZoom: 1,
      maxPitch: 85,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new AttributionControl({
        compact: true,
        customAttribution:
          "境界データ: 地球地図日本（国土地理院）、Natural Earth",
      }),
    );
    map.addControl(
      new NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(new GlobeControl(), "top-right");
    map.addControl(
      new TerrainControl({ source: "terrain", exaggeration: 1.5 }),
      "top-right",
    );

    const detachOrbitGestures = attachOrbitGestures(
      map,
      () => modeRef.current === "orbit",
    );

    // 読み込みを待つあいだにページを離れたら、何もしない
    let cancelled = false;
    map.on("load", () => {
      loadPlateauLayerMeta()
        .then((layer) => {
          if (cancelled) return;
          if (!layer) {
            setBuildingsStatus("failed");
            return;
          }
          addPlateauBuildings(map, layer);
          setBuildingsStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setBuildingsStatus("failed");
        });
    });

    // 塗った県・国をクリックすると、行った日数を出す（県を優先）
    const clickable = ["visited-prefectures", "visited-countries"];
    map.on("click", (e) => {
      const layers = clickable.filter((id) => map.getLayer(id));
      const [hit] = map.queryRenderedFeatures(e.point, { layers });
      if (!hit) return;
      new Popup({ closeButton: false })
        .setLngLat(e.lngLat)
        .setDOMContent(popupContent(hit.properties))
        .addTo(map);
    });
    for (const id of clickable) {
      map.on("mouseenter", id, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", id, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    return () => {
      cancelled = true;
      detachOrbitGestures();
      map.remove();
      mapRef.current = null;
    };
  }, [prefectures, countries]);

  // 「回転・傾き」モードでは、1 本指のドラッグを移動ではなく回転・傾きに使う
  useEffect(() => {
    modeRef.current = mode;
    const map = mapRef.current;
    if (!map) return;
    if (mode === "orbit") map.dragPan.disable();
    else map.dragPan.enable();
  }, [mode]);

  const rotate = (degrees: number) => {
    const map = mapRef.current;
    map?.easeTo({ bearing: map.getBearing() + degrees, duration: 300 });
  };
  const tilt = (degrees: number) => {
    const map = mapRef.current;
    map?.easeTo({ pitch: map.getPitch() + degrees, duration: 300 });
  };
  const resetView = () => {
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 600 });
  };

  const flyTo = (place: Place) => {
    mapRef.current?.flyTo({
      center: place.center,
      zoom: place.zoom,
      pitch: place.pitch,
      bearing: place.bearing,
      duration: 4000,
      essential: true,
    });
  };

  return (
    <div className="relative flex-1">
      {/* MapLibre の CSS が地図の箱を position: relative にするので、外側の箱で広げる */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="size-full bg-[#050b18]" />
      </div>

      <div className="absolute top-3 left-3 flex max-w-[calc(100%-5rem)] flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PLACES.map((place) => (
            <Button
              key={place.label}
              size="sm"
              variant="secondary"
              className="shadow"
              onClick={() => flyTo(place)}
            >
              {place.label}
            </Button>
          ))}
        </div>
        <div className="w-fit rounded-md bg-background/85 px-3 py-2 text-xs shadow backdrop-blur">
          <p className="mb-1 font-medium">行った日数</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {BINS.map((bin) => (
              <li key={bin.label} className="flex items-center gap-1.5">
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: bin.fill }}
                />
                {bin.label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted-foreground">
            {buildingsStatus === "failed"
              ? "3D の建物データを読み込めませんでした"
              : "都市を大きく拡大すると、3D の建物が立ち上がります"}
          </p>
        </div>
      </div>

      <div className="absolute right-3 bottom-9">
        <ViewControls
          mode={mode}
          onModeChange={setMode}
          onRotate={rotate}
          onTilt={tilt}
          onReset={resetView}
        />
        <p className="mt-1.5 max-w-56 rounded-md bg-background/85 px-2 py-1 text-[11px] text-muted-foreground shadow backdrop-blur">
          {mode === "orbit"
            ? "ドラッグ・2本指スワイプで回転と傾き。ピンチでズーム"
            : "Ctrl＋ドラッグ、Shift＋矢印キーでも回転・傾きができます"}
        </p>
      </div>
    </div>
  );
}
