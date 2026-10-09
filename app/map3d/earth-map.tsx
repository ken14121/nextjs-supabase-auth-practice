"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  type AddProtocolAction,
  AttributionControl,
  addProtocol,
  GlobeControl,
  type LngLatLike,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  TerrainControl,
} from "maplibre-gl";
import { PMTiles, Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { VisitedFeatures } from "@/lib/geo/visited-geojson";
import {
  buildingsFullZoom,
  buildStyle,
  type Look,
  legendFor,
  PLATEAU_URL,
  type PlateauMeta,
  spaceColor,
} from "./earth-style";
import { GSI_DEM_PROTOCOL, gsiDemProtocol } from "./gsi-dem";
import { LookSwitch, readSavedLook, saveLook } from "./look-switch";
import { attachOrbitGestures } from "./orbit-gestures";
import { type GestureMode, ViewControls } from "./view-controls";

// 疑似 Google Earth。MapLibre GL JS で、地球儀 → 日本 → 3D の山 → 3D のビル と拡大していける地図

type Place = {
  label: string;
  center: LngLatLike;
  zoom: number;
  pitch: number;
  bearing: number;
  // 建物を見るための場所（建物が伸びきるところまで近づく）
  buildings?: boolean;
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
    buildings: true,
  },
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

// PMTiles の先頭（ヘッダーとメタデータ）だけを読み、建物のレイヤー名・高さの項目名・ズームの範囲を調べる
async function loadPlateauMeta(): Promise<PlateauMeta | null> {
  const archive = new PMTiles(PLATEAU_URL);
  pmtilesProtocol.add(archive);
  const [header, metadata] = await Promise.all([
    archive.getHeader(),
    archive.getMetadata() as Promise<{ vector_layers?: VectorLayerMeta[] }>,
  ]);
  const layer = metadata.vector_layers?.[0];
  if (!layer) return null;
  return {
    layerId: layer.id,
    heightField: pickHeightField(layer.fields ?? {}),
    minZoom: header.minZoom,
  };
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
  const [look, setLook] = useState<Look>(readSavedLook);
  const [plateau, setPlateau] = useState<PlateauMeta | null>(null);
  const [buildingsFailed, setBuildingsFailed] = useState(false);
  const [mode, setMode] = useState<GestureMode>("pan");
  // 地図のイベントの中から、いまのモードを読むための入れ物
  const modeRef = useRef<GestureMode>("pan");
  // 地図を作るとき・最後に当てたときのスタイルの材料（同じなら当て直さない）
  const appliedRef = useRef<{ look: Look; plateau: PlateauMeta | null }>({
    look,
    plateau: null,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: 見た目（look）が変わっても地図は作り直さない（下の useEffect で差分だけ当てる）
  useEffect(() => {
    if (!containerRef.current) return;
    setupMapLibreOnce();

    const start = PLACES[0];
    appliedRef.current = { look, plateau: null };
    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle({
        visited: { prefectures, countries },
        look,
        plateau: null,
      }),
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
      loadPlateauMeta()
        .then((meta) => {
          if (cancelled) return;
          if (meta) setPlateau(meta);
          else setBuildingsFailed(true);
        })
        .catch(() => {
          if (!cancelled) setBuildingsFailed(true);
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

  // 見た目を切り替えたとき・建物のデータが届いたときは、新しいスタイルとの差分だけを当てる
  //（地図を作り直さないので、見ている場所やカメラの角度はそのまま）
  useEffect(() => {
    const map = mapRef.current;
    const applied = appliedRef.current;
    if (!map || (applied.look === look && applied.plateau === plateau)) return;
    appliedRef.current = { look, plateau };
    map.setStyle(
      buildStyle({ visited: { prefectures, countries }, look, plateau }),
      {
        diff: true,
        // 右上のボタンで山の立体（terrain）を消していたら、消したままにする
        transformStyle: (previous, next) => ({
          ...next,
          terrain: previous?.terrain,
        }),
      },
    );
  }, [look, plateau, prefectures, countries]);

  const changeLook = (next: Look) => {
    setLook(next);
    saveLook(next);
  };

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
      zoom:
        place.buildings && plateau
          ? Math.max(place.zoom, buildingsFullZoom(plateau) + 0.1)
          : place.zoom,
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
        <div
          ref={containerRef}
          className="size-full transition-colors duration-500"
          style={{ backgroundColor: spaceColor(look) }}
        />
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
        <LookSwitch look={look} onChange={changeLook} />
        <div className="w-fit rounded-md bg-background/85 px-3 py-2 text-xs shadow backdrop-blur">
          <p className="mb-1 font-medium">行った日数</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {legendFor(look).map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted-foreground">
            {buildingsFailed
              ? "3D の建物データを読み込めませんでした"
              : "都市を大きく拡大すると、3D の建物が建ち上がります"}
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
