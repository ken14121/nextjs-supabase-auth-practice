"use client";

import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobeCountry } from "@/lib/geo/map-shapes";

// 地図帳の「世界」：行った国を塗った地球儀。ドラッグで回せる（拡大はしない）。
// 触っていないあいだは、ゆっくり自転する（動きを減らす設定の人には自転させない）

export type GlobePaint = Record<string, { fill: string; title: string }>;

const SIZE = 480;
// 1 秒に回る角度
const SPIN_DEG_PER_SEC = 6;
// ドラッグ 1px で回る角度
const DRAG_DEG_PER_PX = 0.35;
// 最初に正面に来る場所（日本のあたり）
const START: [number, number] = [-138, -30];

export function WorldGlobe({
  paint,
  notVisitedFill,
  seaFill,
  markers,
  label,
}: {
  // 行った国だけの色と説明（行っていない国は notVisitedFill）
  paint: GlobePaint;
  notVisitedFill: string;
  seaFill: string;
  // 粗い地図に形がない小さな国（中心の経度・緯度）
  markers: { code: string; lngLat: [number, number] }[];
  label: string;
}) {
  const [countries, setCountries] = useState<GlobeCountry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [rotation, setRotation] = useState<[number, number]>(START);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);

  // 国の形は大きいので、地球儀を開いたときに読み込む（ビルド時に作った静的なファイル）
  useEffect(() => {
    let cancelled = false;
    fetch("/geo/countries")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: GlobeCountry[]) => {
        if (!cancelled) setCountries(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 自転。ドラッグ中・カーソルを乗せているあいだ・動きを減らす設定のときは止める
  useEffect(() => {
    if (paused || !countries) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      setRotation(([lng, lat]) => [lng + SPIN_DEG_PER_SEC * dt, lat]);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, countries]);

  const path = useMemo(() => {
    const projection = geoOrthographic()
      .translate([SIZE / 2, SIZE / 2])
      .scale(SIZE / 2 - 4)
      .clipAngle(90)
      .rotate(rotation);
    return { draw: geoPath(projection), projection };
  }, [rotation]);

  const rotateBy = (dLng: number, dLat: number) =>
    setRotation(([lng, lat]) => [
      lng + dLng,
      Math.max(-80, Math.min(80, lat + dLat)),
    ]);

  // 経度・緯度の点が、いま地球の表側にあるか
  const isVisible = ([lng, lat]: [number, number]) => {
    const [rl, rp] = rotation;
    const toRad = Math.PI / 180;
    const cos =
      Math.sin(-rp * toRad) * Math.sin(lat * toRad) +
      Math.cos(-rp * toRad) *
        Math.cos(lat * toRad) *
        Math.cos((lng + rl) * toRad);
    return cos > 0;
  };

  return (
    <div className="mx-auto w-full max-w-[28rem]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        role="img"
        aria-label={`${label}（ドラッグや矢印キーで回せます）`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: 矢印キーで地球儀を回せるように、フォーカスできるようにする
        tabIndex={0}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => {
          if (!dragging.current) setPaused(false);
        }}
        onPointerDown={(e) => {
          dragging.current = { x: e.clientX, y: e.clientY };
          setPaused(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const dx = e.clientX - dragging.current.x;
          const dy = e.clientY - dragging.current.y;
          dragging.current = { x: e.clientX, y: e.clientY };
          rotateBy(dx * DRAG_DEG_PER_PX, -dy * DRAG_DEG_PER_PX);
        }}
        onPointerUp={(e) => {
          dragging.current = null;
          // タッチ操作は「カーソルが離れる」が来ないので、ここで自転に戻す
          if (e.pointerType !== "mouse") setPaused(false);
        }}
        onKeyDown={(e) => {
          const step = 10;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
          };
          const move = moves[e.key];
          if (!move) return;
          e.preventDefault();
          setPaused(true);
          rotateBy(move[0], move[1]);
        }}
        onBlur={() => setPaused(false)}
      >
        <path
          d={path.draw({ type: "Sphere" }) ?? ""}
          fill={seaFill}
          className="stroke-foreground"
          strokeWidth={0.8}
        />
        <path
          d={path.draw(geoGraticule10()) ?? ""}
          fill="none"
          className="stroke-rule"
          strokeWidth={0.5}
        />
        {countries?.map((c) => {
          const d = path.draw(c.geometry);
          if (!d) return null;
          const p = paint[c.code];
          return (
            <path
              key={c.code}
              d={d}
              fill={p?.fill ?? notVisitedFill}
              className="stroke-paper"
              strokeWidth={0.5}
            >
              {p && <title>{p.title}</title>}
            </path>
          );
        })}
        {markers.map(({ code, lngLat }) => {
          if (!isVisible(lngLat)) return null;
          const point = path.projection(lngLat);
          const p = paint[code];
          if (!point || !p) return null;
          return (
            <circle
              key={code}
              cx={point[0]}
              cy={point[1]}
              r={5}
              fill={p.fill}
              className="stroke-paper"
              strokeWidth={2}
            >
              <title>{p.title}</title>
            </circle>
          );
        })}
      </svg>
      {failed && (
        <p className="text-center text-xs text-muted-foreground">
          世界地図を読み込めませんでした。ページを開き直してください。
        </p>
      )}
    </div>
  );
}
