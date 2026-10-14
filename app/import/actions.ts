"use server";

import { revalidatePath } from "next/cache";
import { nearestAirport } from "@/lib/geo/airports";
import { lookupMunicipality } from "@/lib/geo/municipalities";
import { lookupRegion } from "@/lib/geo/regions";
import { nearestShinkansenStation } from "@/lib/geo/shinkansen";
import { createClient } from "@/lib/supabase/server";
import { computeOutingFeatures } from "@/lib/timeline/features";
import { extractFlights } from "@/lib/timeline/flights";
import { matchOutings } from "@/lib/timeline/match";
import { computeMunicipalityLevels } from "@/lib/timeline/municipality-levels";
import { buildOutings, toJstDate } from "@/lib/timeline/outings";
import { compactTimelineSchema } from "@/lib/timeline/parse";
import { extractShinkansenRides } from "@/lib/timeline/rail";

export type ImportResult =
  | {
      ok: true;
      outings: number;
      prefectures: number;
      countries: number;
      municipalities: number;
    }
  | { ok: false; message: string };

const BUCKET = "timelines";
const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// 市区町村の経験値を、前に取り込んだ分と合わせて保存する。保存した市区町村の数を返す
async function saveMunicipalityLevels(
  supabase: Supabase,
  userId: string,
  levels: ReturnType<typeof computeMunicipalityLevels>,
): Promise<number> {
  if (levels.length === 0) return 0;
  const { data: existing, error: readError } = await supabase
    .from("municipality_levels")
    .select("code, level, first_visited_on, last_visited_on")
    .range(0, 9999);
  if (readError) throw readError;
  const before = new Map((existing ?? []).map((r) => [r.code, r]));
  const rows = levels.map((l) => {
    const prev = before.get(l.code);
    return {
      user_id: userId,
      code: l.code,
      level: Math.max(l.level, prev?.level ?? 0),
      first_visited_on:
        prev && prev.first_visited_on < l.firstOn
          ? prev.first_visited_on
          : l.firstOn,
      last_visited_on:
        prev && prev.last_visited_on > l.lastOn
          ? prev.last_visited_on
          : l.lastOn,
      updated_at: new Date().toISOString(),
    };
  });
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from("municipality_levels")
      .upsert(part, { onConflict: "user_id,code" });
    if (error) throw error;
  }
  return new Set([...before.keys(), ...rows.map((r) => r.code)]).size;
}

// 飛行機の便を、その便の時刻を含む外出にぶら下げて保存する
async function saveFlights(
  supabase: Supabase,
  userId: string,
  outings: { id: string | undefined; startedAt: number; endedAt: number }[],
  flights: ReturnType<typeof extractFlights>,
) {
  const ids = outings.flatMap((o) => (o.id ? [o.id] : []));
  const designs = new Map<number, string>();
  for (const part of chunk(ids, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("flights")
      .select("departed_at, design")
      .in("outing_id", part)
      .not("design", "is", null);
    if (error) throw error;
    for (const f of data ?? []) {
      if (f.design) designs.set(Date.parse(f.departed_at), f.design);
    }
  }
  for (const part of chunk(ids, CHUNK_SIZE)) {
    const { error } = await supabase
      .from("flights")
      .delete()
      .in("outing_id", part);
    if (error) throw error;
  }
  const rows = flights.flatMap((f) => {
    const at = Date.parse(f.departedAt);
    const outing = outings.find(
      (o) => o.id && at >= o.startedAt && at <= o.endedAt,
    );
    if (!outing?.id) return [];
    return [
      {
        user_id: userId,
        outing_id: outing.id,
        departed_at: f.departedAt,
        arrived_at: f.arrivedAt,
        from_airport: f.from,
        to_airport: f.to,
        distance_km: f.distanceKm,
        design: designs.get(at) ?? null,
      },
    ];
  });
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from("flights").insert(part);
    if (error) throw error;
  }
}

// 新幹線の乗車を、その時刻を含む外出にぶら下げて保存する
async function saveRides(
  supabase: Supabase,
  userId: string,
  outings: { id: string | undefined; startedAt: number; endedAt: number }[],
  rides: ReturnType<typeof extractShinkansenRides>,
) {
  const ids = outings.flatMap((o) => (o.id ? [o.id] : []));
  const designs = new Map<number, string>();
  for (const part of chunk(ids, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("train_rides")
      .select("departed_at, design")
      .in("outing_id", part)
      .not("design", "is", null);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.design) designs.set(Date.parse(r.departed_at), r.design);
    }
  }
  for (const part of chunk(ids, CHUNK_SIZE)) {
    const { error } = await supabase
      .from("train_rides")
      .delete()
      .in("outing_id", part);
    if (error) throw error;
  }
  const rows = rides.flatMap((r) => {
    const at = Date.parse(r.departedAt);
    const outing = outings.find(
      (o) => o.id && at >= o.startedAt && at <= o.endedAt,
    );
    if (!outing?.id) return [];
    return [
      {
        user_id: userId,
        outing_id: outing.id,
        departed_at: r.departedAt,
        arrived_at: r.arrivedAt,
        from_station: r.from,
        to_station: r.to,
        distance_km: r.distanceKm,
        design: designs.get(at) ?? null,
      },
    ];
  });
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from("train_rides").insert(part);
    if (error) throw error;
  }
}

// ブラウザが Storage に置いたファイルを読み、外出と行った県・国を DB に保存する。
// ファイルの中身はブラウザから来たものなので信用せず、ここでもう一度チェックする。
export async function importTimeline(path: string): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) {
    return {
      ok: false,
      message: "ログインし直してから、もう一度お試しください。",
    };
  }
  // 自分のフォルダ以外のファイルは扱わない（Storage の RLS でも防いでいる）
  if (!path.startsWith(`${userId}/`) || path.includes("..")) {
    return { ok: false, message: "ファイルの場所が正しくありません。" };
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(path);
    if (downloadError || !file) {
      return {
        ok: false,
        message: "アップロードしたファイルを読み込めませんでした。",
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return { ok: false, message: "ファイルの形式が正しくありません。" };
    }
    const parsed = compactTimelineSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, message: "ファイルの形式が正しくありません。" };
    }

    const drafts = buildOutings(parsed.data.segments);
    if (drafts.length === 0) {
      return {
        ok: false,
        message:
          "自宅の周りから出た外出が見つかりませんでした。もっと長い期間を書き出したファイルでお試しください。",
      };
    }

    // 「いつもの場所」「ふだん行かない場所」にいた時間などを、ファイル全体から数える（座標は保存しない）
    const features = computeOutingFeatures(drafts);
    const withFeatures = drafts.map((d, i) => ({
      ...d,
      features: features[i],
    }));

    // 地点の数字が無いまま Jev が判定した外出（本人がまだ確かめていないもの）は、
    // 数字をつけて判定し直せるよう「未判定」に戻す。本人が決めたものはそのまま
    const { error: resetError } = await supabase
      .from("outings")
      .update({ label: null, label_confidence: null, label_source: null })
      .eq("source", "timeline")
      .eq("label_source", "jev")
      .is("features", null);
    if (resetError) throw resetError;

    // このファイルの期間に入っている、取り込み済みの外出（手入力の旅は対象外）
    const spanStart = withFeatures[0].startedAt;
    const spanEnd = withFeatures.reduce(
      (max, d) => (d.endedAt > max ? d.endedAt : max),
      withFeatures[0].endedAt,
    );
    const { data: existing, error: existingError } = await supabase
      .from("outings")
      .select("id, started_at, ended_at, label_source")
      .eq("source", "timeline")
      .lt("started_at", spanEnd)
      .gt("ended_at", spanStart)
      .range(0, 9999);
    if (existingError) throw existingError;

    // 時間が重なる外出は同じ外出とみなし、その行（判定・メモ）を引き継ぐ。
    // Google のタイムラインは、あとから開始時刻が数分ずれることがあるため（lib/timeline/match.ts）
    const { matchedIds, unmatchedIds } = matchOutings(
      withFeatures,
      (existing ?? []).map((e) => ({
        id: e.id,
        startedAt: e.started_at,
        endedAt: e.ended_at,
        userLabeled: e.label_source === "user",
      })),
    );

    // 期間内なのに、どの新しい外出とも重ならない行（前の取り込みでできた重複など）は消す
    for (const ids of chunk(unmatchedIds, CHUNK_SIZE)) {
      const { error } = await supabase.from("outings").delete().in("id", ids);
      if (error) throw error;
    }

    const toRow = (d: (typeof withFeatures)[number]) => ({
      user_id: userId,
      started_at: d.startedAt,
      ended_at: d.endedAt,
      nights: d.nights,
      distance_km: d.distanceKm,
      main_transport: d.mainTransport,
      features: d.features,
      source: "timeline",
    });
    const outingIds = new Map<number, string>();
    const remember = (rows: { id: string; started_at: string }[]) => {
      for (const row of rows) outingIds.set(Date.parse(row.started_at), row.id);
    };

    // 引き継ぐ外出は、同じ id の行を新しい内容で上書き（Jev の判定・本人の判定・メモは残る）
    const updates = withFeatures.flatMap((d, i) => {
      const id = matchedIds[i];
      return id ? [{ id, ...toRow(d) }] : [];
    });
    for (const rows of chunk(updates, CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("outings")
        .upsert(rows, { onConflict: "id" })
        .select("id, started_at");
      if (error) throw error;
      remember(data);
    }

    // 新しい外出は追加（念のため、同じ開始時刻の行があれば上書き）
    const inserts = withFeatures.filter((_, i) => matchedIds[i] === null);
    for (const rows of chunk(inserts, CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("outings")
        .upsert(rows.map(toRow), { onConflict: "user_id,timeline_started_at" })
        .select("id, started_at");
      if (error) throw error;
      remember(data);
    }

    // 行った県・国を、外出ごと・日付ごとに 1 件ずつ作る
    const regionRows: {
      user_id: string;
      outing_id: string;
      region_code: string;
      visited_on: string;
    }[] = [];
    const seen = new Set<string>();
    for (const draft of drafts) {
      const outingId = outingIds.get(Date.parse(draft.startedAt));
      if (!outingId) continue;
      for (const stop of draft.stops) {
        const code = lookupRegion(stop.location.lat, stop.location.lng);
        if (!code) continue;
        const visitedOn = toJstDate(stop.at);
        const key = `${outingId}|${code}|${visitedOn}`;
        if (seen.has(key)) continue;
        seen.add(key);
        regionRows.push({
          user_id: userId,
          outing_id: outingId,
          region_code: code,
          visited_on: visitedOn,
        });
      }
    }

    // 取り込み直しに備えて、対象の外出の訪問地をいったん消してから入れ直す
    for (const ids of chunk([...outingIds.values()], CHUNK_SIZE)) {
      const { error } = await supabase
        .from("visited_regions")
        .delete()
        .in("outing_id", ids);
      if (error) throw error;
    }
    for (const rows of chunk(regionRows, CHUNK_SIZE)) {
      const { error } = await supabase.from("visited_regions").insert(rows);
      if (error) throw error;
    }

    // 飛行機の便（搭乗券）。外出ごとに消して入れ直すが、本人が選んだデザインは出発時刻で引き継ぐ
    await saveFlights(
      supabase,
      userId,
      drafts.map((d) => ({
        id: outingIds.get(Date.parse(d.startedAt)),
        startedAt: Date.parse(d.startedAt),
        endedAt: Date.parse(d.endedAt),
      })),
      extractFlights(parsed.data.segments, nearestAirport),
    );

    // 新幹線の乗車（切符）。便と同じく、選んだデザインは出発時刻で引き継ぐ
    await saveRides(
      supabase,
      userId,
      drafts.map((d) => ({
        id: outingIds.get(Date.parse(d.startedAt)),
        startedAt: Date.parse(d.startedAt),
        endedAt: Date.parse(d.endedAt),
      })),
      extractShinkansenRides(parsed.data.segments, nearestShinkansenStation),
    );

    // 市区町村の経験値（住居・宿泊・訪問・接地・通過）。座標は保存せず、コードと経験値と日付だけ。
    // 前に取り込んだ分と合わせ、経験値は高い方、日付は広がる方に合わせる
    const municipalityCount = await saveMunicipalityLevels(
      supabase,
      userId,
      computeMunicipalityLevels(
        parsed.data.segments,
        parsed.data.paths ?? [],
        lookupMunicipality,
      ),
    );

    const codes = new Set(regionRows.map((r) => r.region_code));
    const prefectures = [...codes].filter((c) => c.startsWith("JP-")).length;
    const countries = new Set(
      [...codes].map((c) => (c.startsWith("JP-") ? "JP" : c)),
    ).size;

    revalidatePath("/dashboard");
    revalidatePath("/outings", "layout");
    revalidatePath("/municipalities");
    return {
      ok: true,
      outings: drafts.length,
      prefectures,
      countries,
      municipalities: municipalityCount,
    };
  } catch (error) {
    console.error("Timeline import failed", error);
    return {
      ok: false,
      message:
        "保存中にエラーが起きました。時間をおいてもう一度お試しください。",
    };
  } finally {
    // 位置情報の元ファイルは残さない（成功しても失敗しても消す）
    await supabase.storage.from(BUCKET).remove([path]);
  }
}
