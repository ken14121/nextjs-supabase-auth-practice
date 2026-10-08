import { regionName } from "@/lib/geo/names";
import type { OutingFeatures } from "@/lib/timeline/features";

// Jev に渡す「外出 1 回ぶんの状況」を作る。
// Jev は計算が苦手なので、泊数・距離・行った回数・季節などはここで計算して、
// 判断に使いやすい形（日本語の JSON）にしてから渡す。

export type OutingForJev = {
  started_at: string;
  ended_at: string;
  nights: number;
  distance_km: number;
  main_transport: string | null;
  region_codes: string[];
  // 取り込み直す前の外出には無い
  features?: OutingFeatures | null;
};

export type JevContext = {
  // 都道府県・国ごとの「これまでに行った日数」（取り込んだ記録すべてから）
  visitedDays: Map<string, number>;
  // 住んでいる都道府県（一番多く行った都道府県とみなす）
  homeRegion: string | null;
};

// この日数以上行っている場所は「よく行く場所」とみなす
export const FREQUENT_DAYS = 30;

const TRANSPORT_NAMES: Record<string, string> = {
  walk: "徒歩",
  bicycle: "自転車",
  car: "車",
  bus: "バス",
  train: "電車",
  flight: "飛行機",
  boat: "船",
  other: "その他",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function jstDate(iso: string): Date {
  // 日本時間の日付・曜日を取り出すために、9 時間ずらした UTC として扱う
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000);
}

function formatDate(iso: string): string {
  const d = jstDate(iso);
  return `${d.toISOString().slice(0, 10)}（${WEEKDAYS[d.getUTCDay()]}）`;
}

function formatTime(iso: string): string {
  return jstDate(iso).toISOString().slice(11, 16);
}

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

// 帰省や旅行が多い時期にかかっているか（月日だけで判断）
export function seasonOf(startIso: string, endIso: string): string | null {
  const SEASONS = [
    { name: "年末年始", from: "12-28", to: "01-04" },
    { name: "ゴールデンウィーク", from: "04-29", to: "05-06" },
    { name: "お盆", from: "08-10", to: "08-18" },
  ];
  const start = jstDate(startIso);
  const end = jstDate(endIso);
  for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
    const md = d.toISOString().slice(5, 10);
    for (const s of SEASONS) {
      const inside =
        s.from <= s.to
          ? md >= s.from && md <= s.to
          : md >= s.from || md <= s.to;
      if (inside) return s.name;
    }
    // 長い外出でも 2 週間ぶん見れば十分
    if (d.getTime() - start.getTime() > 14 * 86400000) break;
  }
  return null;
}

export function buildOutingState(outing: OutingForJev, ctx: JevContext) {
  const places = [...new Set(outing.region_codes)].map((code) => {
    const days = ctx.visitedDays.get(code) ?? 0;
    return {
      場所: regionName(code),
      これまでに行った日数: days,
      よく行く場所: days >= FREQUENT_DAYS,
      住んでいる都道府県: code === ctx.homeRegion,
    };
  });

  const f = outing.features;
  const startDay = jstDate(outing.started_at).getUTCDay();
  return {
    出発: `${formatDate(outing.started_at)} ${formatTime(outing.started_at)}`,
    帰宅: `${formatDate(outing.ended_at)} ${formatTime(outing.ended_at)}`,
    土日: startDay === 0 || startDay === 6,
    泊数: outing.nights,
    移動した距離_km: Math.round(outing.distance_km),
    主な移動手段: outing.main_transport
      ? (TRANSPORT_NAMES[outing.main_transport] ?? outing.main_transport)
      : "不明",
    行った場所: places,
    住んでいる都道府県: ctx.homeRegion ? regionName(ctx.homeRegion) : "不明",
    時期: seasonOf(outing.started_at, outing.ended_at) ?? "とくになし",
    // 地点ごとの数字（タイムラインを取り込み直したあとの外出だけ）
    ...(f
      ? {
          自宅から一番遠い地点_km: Math.round(f.maxKmFromHome),
          いつもの場所での滞在_時間: hours(f.frequentMinutes),
          ときどき行く場所での滞在_時間: hours(f.sometimesMinutes),
          ふだん行かない場所での滞在_時間: hours(f.rareMinutes),
          ふだん行かない場所の数: f.rarePlaces,
          いつもの場所以外での滞在_時間: hours(
            f.sometimesMinutes + f.rareMinutes,
          ),
        }
      : {}),
  };
}
