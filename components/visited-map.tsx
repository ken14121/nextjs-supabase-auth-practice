import { Globe2, Map as MapIcon } from "lucide-react";
import {
  JapanRegionMap,
  MapLegend,
  type RegionPaint,
  WorldRegionMap,
} from "@/components/region-maps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPrefectureCode, regionName } from "@/lib/geo/names";
import {
  BINS,
  fillFor,
  NOT_VISITED_FILL,
  type VisitedRegion,
} from "@/lib/geo/visited-colors";

// 行った県・国を、行った日数の多さで濃く塗る地図（日本 / 世界の切り替え付き）

function paintByDays(visited: Map<string, VisitedRegion>): RegionPaint {
  return (code) => {
    const region = visited.get(code);
    const name = regionName(code);
    return {
      fill: fillFor(region?.visited_days),
      title: region
        ? `${name}：${region.visited_days}日（初めて ${region.first_visited_on}、最後 ${region.last_visited_on}）`
        : `${name}：まだ行っていません`,
    };
  };
}

const LEGEND = [
  { label: "行っていない", fill: NOT_VISITED_FILL },
  ...BINS.map((bin) => ({ label: bin.label, fill: bin.fill })),
];

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
        <JapanRegionMap
          paint={paintByDays(prefectures)}
          label="行った都道府県の地図"
        />
      </TabsContent>
      <TabsContent value="world">
        <WorldRegionMap
          paint={paintByDays(worldCountries)}
          highlighted={[...worldCountries.keys()]}
          label="行った国の地図"
        />
      </TabsContent>
      <MapLegend items={LEGEND} />
      <p className="text-xs text-muted-foreground">
        県や国にカーソルを合わせると、行った日数と日付が出ます。世界地図の日本は、一番多く行った県の日数で塗っています。
      </p>
    </Tabs>
  );
}
