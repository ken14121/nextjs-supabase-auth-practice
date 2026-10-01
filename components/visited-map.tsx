import { Globe2, Map as MapIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getJapanShapes,
  getWorldMarker,
  getWorldShapes,
  JAPAN_SIZE,
  OKINAWA_INSET,
  WORLD_SIZE,
} from "@/lib/geo/map-shapes";
import { isPrefectureCode, regionName } from "@/lib/geo/names";

// 行った県・国を、行った日数の多さで濃く塗る地図（日本 / 世界の切り替え付き）

export type VisitedRegion = {
  region_code: string;
  first_visited_on: string;
  last_visited_on: string;
  visited_days: number;
};

// 行った日数の段階。1 色（青）を薄い → 濃いで使う
const BINS = [
  { min: 1, label: "1日", fill: "#86b6ef" },
  { min: 2, label: "2〜4日", fill: "#3987e5" },
  { min: 5, label: "5〜19日", fill: "#1c5cab" },
  { min: 20, label: "20日以上", fill: "#0d366b" },
] as const;
const NOT_VISITED_FILL = "#e7e6e2";
const SEA_FILL = "#f4f7fb";

function fillFor(days: number | undefined) {
  if (!days) return NOT_VISITED_FILL;
  let fill: string = BINS[0].fill;
  for (const bin of BINS) {
    if (days >= bin.min) fill = bin.fill;
  }
  return fill;
}

function tooltip(code: string, region: VisitedRegion | undefined) {
  const name = regionName(code);
  if (!region) return `${name}：まだ行っていません`;
  return `${name}：${region.visited_days}日（初めて ${region.first_visited_on}、最後 ${region.last_visited_on}）`;
}

const shapeClass =
  "stroke-white transition-[stroke,stroke-width] hover:stroke-foreground focus-visible:stroke-foreground focus-visible:outline-none";

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-sm border"
          style={{ backgroundColor: NOT_VISITED_FILL }}
        />
        行っていない
      </li>
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
  );
}

function JapanMap({ visited }: { visited: Map<string, VisitedRegion> }) {
  const shapes = getJapanShapes();
  return (
    <svg
      viewBox={`0 0 ${JAPAN_SIZE.width} ${JAPAN_SIZE.height}`}
      className="h-auto w-full"
      role="img"
      aria-label="行った都道府県の地図"
    >
      <defs>
        <clipPath id="okinawa-inset">
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
        const region = visited.get(shape.code);
        return (
          <path
            key={shape.code}
            d={shape.d}
            fill={fillFor(region?.visited_days)}
            strokeWidth={0.8}
            className={shapeClass}
            clipPath={
              shape.code === "JP-47" ? "url(#okinawa-inset)" : undefined
            }
            tabIndex={0}
          >
            <title>{tooltip(shape.code, region)}</title>
          </path>
        );
      })}
    </svg>
  );
}

function WorldMap({ visited }: { visited: Map<string, VisitedRegion> }) {
  const { countries, sphere, graticule } = getWorldShapes();
  const drawn = new Set(countries.map((c) => c.code));
  // 小さくて地図に形がない国は、点で表す
  const markers = [...visited.keys()]
    .filter((code) => !drawn.has(code))
    .map((code) => ({ code, point: getWorldMarker(code) }))
    .filter((m): m is { code: string; point: [number, number] } => !!m.point);

  return (
    <svg
      viewBox={`0 0 ${WORLD_SIZE.width} ${WORLD_SIZE.height}`}
      className="h-auto w-full"
      role="img"
      aria-label="行った国の地図"
    >
      <path d={sphere} fill={SEA_FILL} className="stroke-border" />
      <path
        d={graticule}
        fill="none"
        className="stroke-border"
        strokeWidth={0.5}
      />
      {countries.map((shape) => {
        const region = visited.get(shape.code);
        return (
          <path
            key={shape.code}
            d={shape.d}
            fill={fillFor(region?.visited_days)}
            strokeWidth={0.5}
            className={shapeClass}
            tabIndex={0}
          >
            <title>{tooltip(shape.code, region)}</title>
          </path>
        );
      })}
      {markers.map(({ code, point }) => {
        const region = visited.get(code);
        return (
          <circle
            key={code}
            cx={point[0]}
            cy={point[1]}
            r={5}
            fill={fillFor(region?.visited_days)}
            className="stroke-white"
            strokeWidth={2}
            tabIndex={0}
          >
            <title>{tooltip(code, region)}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export function VisitedMap({ regions }: { regions: VisitedRegion[] }) {
  // 日本地図は都道府県ごと。世界地図は国ごと（日本の県はまとめて「JP」にする）
  const prefectures = new Map<string, VisitedRegion>();
  const worldCountries = new Map<string, VisitedRegion>();
  for (const region of regions) {
    if (isPrefectureCode(region.region_code)) {
      prefectures.set(region.region_code, region);
      const jp = worldCountries.get("JP");
      worldCountries.set("JP", {
        region_code: "JP",
        first_visited_on:
          !jp || region.first_visited_on < jp.first_visited_on
            ? region.first_visited_on
            : jp.first_visited_on,
        last_visited_on:
          !jp || region.last_visited_on > jp.last_visited_on
            ? region.last_visited_on
            : jp.last_visited_on,
        visited_days: Math.max(jp?.visited_days ?? 0, region.visited_days),
      });
    } else {
      worldCountries.set(region.region_code, region);
    }
  }

  return (
    <Tabs defaultValue="japan">
      <TabsList>
        <TabsTrigger value="japan">
          <MapIcon />
          日本
        </TabsTrigger>
        <TabsTrigger value="world">
          <Globe2 />
          世界
        </TabsTrigger>
      </TabsList>
      <TabsContent value="japan">
        <JapanMap visited={prefectures} />
      </TabsContent>
      <TabsContent value="world">
        <WorldMap visited={worldCountries} />
      </TabsContent>
      <Legend />
      <p className="text-xs text-muted-foreground">
        県や国にカーソルを合わせると、行った日数と日付が出ます。世界地図の日本は、一番多く行った県の日数で塗っています。
      </p>
    </Tabs>
  );
}
