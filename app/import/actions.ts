"use server";

import { revalidatePath } from "next/cache";
import { lookupRegion } from "@/lib/geo/regions";
import { createClient } from "@/lib/supabase/server";
import { buildOutings, toJstDate } from "@/lib/timeline/outings";
import { compactTimelineSchema } from "@/lib/timeline/parse";

export type ImportResult =
  | {
      ok: true;
      outings: number;
      prefectures: number;
      countries: number;
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

    // 外出を保存（同じ開始時刻のものは上書き。Jev の判定やメモは消えない）
    const outingIds = new Map<number, string>();
    for (const rows of chunk(drafts, CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("outings")
        .upsert(
          rows.map((d) => ({
            user_id: userId,
            started_at: d.startedAt,
            ended_at: d.endedAt,
            nights: d.nights,
            distance_km: d.distanceKm,
            main_transport: d.mainTransport,
          })),
          { onConflict: "user_id,started_at" },
        )
        .select("id, started_at");
      if (error) throw error;
      for (const row of data) {
        outingIds.set(Date.parse(row.started_at), row.id);
      }
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

    const codes = new Set(regionRows.map((r) => r.region_code));
    const prefectures = [...codes].filter((c) => c.startsWith("JP-")).length;
    const countries = new Set(
      [...codes].map((c) => (c.startsWith("JP-") ? "JP" : c)),
    ).size;

    revalidatePath("/dashboard");
    return { ok: true, outings: drafts.length, prefectures, countries };
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
