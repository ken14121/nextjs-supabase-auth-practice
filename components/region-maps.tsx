import { useId } from "react";
import { WorldGlobe } from "@/components/world-globe";
import {
  getGlobeCountries,
  getJapanShapes,
  getWorldCentroid,
  JAPAN_SIZE,
  OKINAWA_INSET,
} from "@/lib/geo/map-shapes";
import { NOT_VISITED_FILL } from "@/lib/geo/visited-colors";

// 都道府県・国を色分けする地図（日本は SVG の地図、世界は回せる地球儀）。
// 何色で塗るかは使う側が paint で決める（自分の地図・友達との比較の両方で使う）

export type RegionPaint = (code: string) => { fill: string; title: string };

export const SEA_FILL = "#fbf9f4";

const shapeClass =
  "stroke-paper transition-[stroke,stroke-width] hover:stroke-foreground focus-visible:stroke-foreground focus-visible:outline-none";

export function JapanRegionMap({
  paint,
  label,
}: {
  paint: RegionPaint;
  label: string;
}) {
  const shapes = getJapanShapes();
  // 同じページに地図が 2 つあっても ID がぶつからないようにする
  const clipId = `okinawa-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox={`0 0 ${JAPAN_SIZE.width} ${JAPAN_SIZE.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={OKINAWA_INSET.x}
            y={OKINAWA_INSET.y}
            width={OKINAWA_INSET.width}
            height={OKINAWA_INSET.height}
            rx={10}
          />
        </clipPath>
      </defs>
      <rect
        x={OKINAWA_INSET.x}
        y={OKINAWA_INSET.y}
        width={OKINAWA_INSET.width}
        height={OKINAWA_INSET.height}
        className="fill-none stroke-foreground"
        strokeWidth={0.8}
      />
      <text
        x={OKINAWA_INSET.x + 12}
        y={OKINAWA_INSET.y + 20}
        className="fill-muted-foreground text-[14px]"
      >
        沖縄県
      </text>
      {shapes.map((shape) => {
        const { fill, title } = paint(shape.code);
        return (
          <path
            key={shape.code}
            d={shape.d}
            fill={fill}
            strokeWidth={0.8}
            className={shapeClass}
            clipPath={shape.code === "JP-47" ? `url(#${clipId})` : undefined}
            tabIndex={0}
          >
            <title>{title}</title>
          </path>
        );
      })}
    </svg>
  );
}

// 世界：行った国を塗った、回せる地球儀（components/world-globe.tsx）。
// 地球儀はブラウザで描くので、色の関数ではなく「色を付ける国 → 色と説明」の表にして渡す
export function WorldGlobeMap({
  paint,
  highlighted,
  label,
}: {
  paint: RegionPaint;
  // 色を付ける国。粗い世界地図に形がない小さな国は、点で表す
  highlighted: string[];
  label: string;
}) {
  const drawn = new Set(getGlobeCountries().map((c) => c.code));
  const markers = highlighted
    .filter((code) => !drawn.has(code))
    .map((code) => ({ code, lngLat: getWorldCentroid(code) }))
    .filter(
      (m): m is { code: string; lngLat: [number, number] } => m.lngLat !== null,
    );
  return (
    <WorldGlobe
      paint={Object.fromEntries(highlighted.map((code) => [code, paint(code)]))}
      notVisitedFill={NOT_VISITED_FILL}
      seaFill={SEA_FILL}
      markers={markers}
      label={label}
    />
  );
}

// 凡例。色の四角と名前を並べる
export function MapLegend({
  items,
}: {
  items: { label: string; fill: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm border border-black/10"
            style={{ backgroundColor: item.fill }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
