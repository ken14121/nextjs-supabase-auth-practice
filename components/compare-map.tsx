import { Globe2, Map as MapIcon } from "lucide-react";
import {
  JapanRegionMap,
  MapLegend,
  type RegionPaint,
  WorldRegionMap,
} from "@/components/region-maps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COMPARE_GROUPS,
  type Comparison,
  groupOf,
} from "@/lib/friends/compare";
import { regionName } from "@/lib/geo/names";
import { NOT_VISITED_FILL } from "@/lib/geo/visited-colors";

// 自分と友達の行った県・国を「自分だけ / 友達だけ / どちらも」で塗り分ける地図

function paintByGroup(comparison: Comparison, friendName: string): RegionPaint {
  const labels = {
    mine: "自分だけ行った",
    theirs: `${friendName}さんだけ行った`,
    both: "どちらも行った",
  };
  return (code) => {
    const key = groupOf(code, comparison);
    const group = COMPARE_GROUPS.find((g) => g.key === key);
    return {
      fill: group?.fill ?? NOT_VISITED_FILL,
      title: `${regionName(code)}：${key ? labels[key] : "どちらも行っていない"}`,
    };
  };
}

export function CompareMap({
  prefectures,
  countries,
  friendName,
}: {
  prefectures: Comparison;
  countries: Comparison;
  friendName: string;
}) {
  const legend = [
    ...COMPARE_GROUPS.map((g) => ({
      label: g.key === "theirs" ? `${friendName}さんだけ` : g.label,
      fill: g.fill,
    })),
    { label: "どちらも行っていない", fill: NOT_VISITED_FILL },
  ];

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
          paint={paintByGroup(prefectures, friendName)}
          label="自分と友達の行った都道府県を比べた地図"
        />
      </TabsContent>
      <TabsContent value="world">
        <WorldRegionMap
          paint={paintByGroup(countries, friendName)}
          highlighted={[
            ...countries.mine,
            ...countries.theirs,
            ...countries.both,
          ]}
          label="自分と友達の行った国を比べた地図"
        />
      </TabsContent>
      <MapLegend items={legend} />
    </Tabs>
  );
}
