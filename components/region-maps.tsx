import { useId } from "react";
import {
  getJapanShapes,
  getWorldMarker,
  getWorldShapes,
  JAPAN_SIZE,
  OKINAWA_INSET,
  WORLD_SIZE,
} from "@/lib/geo/map-shapes";

// 都道府県・国を色分けする SVG の地図（日本 / 世界）。
// 何色で塗るかは使う側が paint で決める（自分の地図・友達との比較の両方で使う）

export type RegionPaint = (code: string) => { fill: string; title: string };

const SEA_FILL = "#f4f7fb";

const shapeClass =
  "stroke-white transition-[stroke,stroke-width] hover:stroke-foreground focus-visible:stroke-foreground focus-visible:outline-none";

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
        rx={10}
        className="fill-none stroke-border"
        strokeWidth={1.5}
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

export function WorldRegionMap({
  paint,
  highlighted,
  label,
}: {
  paint: RegionPaint;
  // 色を付ける国。粗い世界地図に形がない小さな国は、点で表す
  highlighted: string[];
  label: string;
}) {
  const { countries, sphere, graticule } = getWorldShapes();
  const drawn = new Set(countries.map((c) => c.code));
  const markers = highlighted
    .filter((code) => !drawn.has(code))
    .map((code) => ({ code, point: getWorldMarker(code) }))
    .filter((m): m is { code: string; point: [number, number] } => !!m.point);

  return (
    <svg
      viewBox={`0 0 ${WORLD_SIZE.width} ${WORLD_SIZE.height}`}
      className="h-auto w-full"
      role="img"
      aria-label={label}
    >
      <path d={sphere} fill={SEA_FILL} className="stroke-border" />
      <path
        d={graticule}
        fill="none"
        className="stroke-border"
        strokeWidth={0.5}
      />
      {countries.map((shape) => {
        const { fill, title } = paint(shape.code);
        return (
          <path
            key={shape.code}
            d={shape.d}
            fill={fill}
            strokeWidth={0.5}
            className={shapeClass}
            tabIndex={0}
          >
            <title>{title}</title>
          </path>
        );
      })}
      {markers.map(({ code, point }) => {
        const { fill, title } = paint(code);
        return (
          <circle
            key={code}
            cx={point[0]}
            cy={point[1]}
            r={5}
            fill={fill}
            className="stroke-white"
            strokeWidth={2}
            tabIndex={0}
          >
            <title>{title}</title>
          </circle>
        );
      })}
    </svg>
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
