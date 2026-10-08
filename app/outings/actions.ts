"use server";

import { APIConnectionError, APIError } from "@typesafe-ai/sdk";
import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { isPrefectureCode } from "@/lib/geo/names";
import {
  classifyOuting,
  createJevClient,
  JevNotConfiguredError,
} from "@/lib/jev/classify";
import type { JevContext } from "@/lib/jev/state";
import { OUTING_LABEL_VALUES } from "@/lib/outings/labels";
import { createClient } from "@/lib/supabase/server";
import { isClearlyDaily, outingFeaturesSchema } from "@/lib/timeline/features";

// 1 回のボタンで Jev に送る件数。多すぎると待ち時間とクレジットがかかるので少しずつ
const BATCH_SIZE = 20;
// 1 回のボタンで「いつもの場所だけの日」かどうかを調べる件数（こちらは Jev を使わない）
const RULE_SCAN_SIZE = 300;
// 同時に Jev へ送る数
const CONCURRENCY = 4;

export type ClassifyResult = {
  ok: boolean;
  message: string;
  classified: number;
  remaining: number;
  // Jev に送った回数と、使ったトークン数（クレジットの目安）
  requests: number;
  tokens: number;
};

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/trips");
  revalidatePath("/friends", "layout");
  revalidatePath("/outings/review");
}

// Jev のエラーを、画面に出せる日本語にする（キーそのものは絶対に出さない）。
// SDK のエラーの種類（instanceof）に加えて、HTTP のステータスコードでも見分ける
function describeError(error: unknown): string {
  if (error instanceof JevNotConfiguredError) {
    return ".env.local に JEV_API_KEY が設定されていません。設定してから yarn dev を起動し直してください。";
  }
  const status =
    error instanceof APIError
      ? error.status
      : typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : null;
  if (status === 401) {
    return "Jev の API キーが正しくないようです（401）。.env.local の JEV_API_KEY を確認してください。";
  }
  if (status === 402 || status === 403) {
    return `Jev に断られました（${status}）。クレジットやキーの権限を確認してください。`;
  }
  if (status === 429) {
    return "Jev の利用回数の上限に達しました。少し時間をおいてから試してください。";
  }
  if (error instanceof APIConnectionError) {
    return "Jev につながりませんでした。ネットワークを確認して、もう一度試してください。";
  }
  if (error instanceof ZodError) {
    return "Jev から思っていない形の答えが返ってきました。";
  }
  return status
    ? `Jev での判定に失敗しました（${status}）。`
    : "Jev での判定に失敗しました。";
}

// 判定の材料：これまでに行った日数と、住んでいる都道府県（一番多く行った都道府県）
function buildContext(
  regions: { region_code: string; visited_days: number }[],
): JevContext {
  const home = regions
    .filter((r) => isPrefectureCode(r.region_code))
    .sort((a, b) => b.visited_days - a.visited_days)[0];
  return {
    visitedDays: new Map(regions.map((r) => [r.region_code, r.visited_days])),
    homeRegion: home?.region_code ?? null,
  };
}

// 配列を limit 件ずつ並行して処理する
async function runWithLimit<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
}

export async function classifyPendingOutings(): Promise<ClassifyResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return {
      ok: false,
      message: "ログインし直してください。",
      classified: 0,
      remaining: 0,
      requests: 0,
      tokens: 0,
    };
  }

  // まだ判定していない、タイムラインから取り込んだ外出（新しい順）
  const pendingQuery = () =>
    supabase
      .from("outings")
      .select("id", { count: "exact", head: true })
      .is("label", null)
      .eq("source", "timeline");

  let client: ReturnType<typeof createJevClient>;
  try {
    client = createJevClient();
  } catch (error) {
    const { count } = await pendingQuery();
    return {
      ok: false,
      message: describeError(error),
      classified: 0,
      remaining: count ?? 0,
      requests: 0,
      tokens: 0,
    };
  }

  const [{ data: regions }, { data: outings }] = await Promise.all([
    supabase.rpc("get_my_regions"),
    supabase
      .from("outings")
      .select(
        "id, started_at, ended_at, nights, distance_km, main_transport, features, visited_regions(region_code)",
      )
      .is("label", null)
      .eq("source", "timeline")
      .order("started_at", { ascending: false })
      .limit(RULE_SCAN_SIZE),
  ]);

  // いつもの場所にしか行っていない日は、Jev に聞かずにコードで「日常」と決める（クレジットを使わない）
  const pending = (outings ?? []).map((o) => {
    const parsed = outingFeaturesSchema.safeParse(o.features);
    return { ...o, features: parsed.success ? parsed.data : null };
  });
  const ruleIds = pending
    .filter((o) => o.features && isClearlyDaily(o.nights, o.features))
    .map((o) => o.id);
  const jevTargets = pending
    .filter((o) => !ruleIds.includes(o.id))
    .slice(0, BATCH_SIZE);

  let ruleCount = 0;
  for (let i = 0; i < ruleIds.length; i += 100) {
    const { data: updated } = await supabase
      .from("outings")
      .update({ label: "daily", label_source: "rule", label_confidence: null })
      .in("id", ruleIds.slice(i, i + 100))
      .is("label", null)
      .select("id");
    ruleCount += updated?.length ?? 0;
  }

  const ctx = buildContext(regions ?? []);

  let classified = ruleCount;
  let requests = 0;
  let tokens = 0;
  let firstError: unknown = null;

  await runWithLimit(jevTargets, CONCURRENCY, async (outing) => {
    if (firstError) return; // キーの間違いなどで失敗したら、残りは送らない
    try {
      requests++;
      const result = await classifyOuting(
        client,
        {
          ...outing,
          region_codes: outing.visited_regions.map((r) => r.region_code),
        },
        ctx,
      );
      // 判定中に本人が手で決めていたら、上書きしない（label が空のときだけ書く）
      const { error } = await supabase
        .from("outings")
        .update({
          label: result.label,
          label_confidence: result.confidence,
          label_source: "jev",
          // 本人が直しても消えないように、Jev の答えを別の列にも残す
          jev_label: result.label,
          jev_confidence: result.confidence,
          jev_p_daily: result.pDaily,
          jev_p_homecoming: result.pHomecoming,
          jev_p_day_trip: result.pDayTrip,
        })
        .eq("id", outing.id)
        .is("label", null);
      tokens += result.tokens;
      if (!error) classified++;
    } catch (error) {
      firstError = error;
    }
  });

  const { count: remaining } = await pendingQuery();
  if (classified > 0) refresh();

  if (firstError) {
    return {
      ok: false,
      message:
        classified > 0
          ? `${classified} 件判定したところで止まりました。${describeError(firstError)}`
          : describeError(firstError),
      classified,
      remaining: remaining ?? 0,
      requests,
      tokens,
    };
  }
  return {
    ok: true,
    message:
      classified > 0
        ? `${classified} 件を判定しました（Jev ${classified - ruleCount} 件・いつもの場所だけの日 ${ruleCount} 件）。`
        : "判定が必要な外出はありません。",
    classified,
    remaining: remaining ?? 0,
    requests,
    tokens,
  };
}

const setLabelSchema = z.object({
  id: z.uuid(),
  label: z.enum(OUTING_LABEL_VALUES),
});

// Jev の判定を本人が直す・「合ってる」と確かめる（同じ種類を送る）。
// どちらも label_source = 'user' になり、Jev は上書きしない。Jev の答え（jev_*）は残る
export async function setOutingLabel(
  input: unknown,
): Promise<{ ok: boolean; message: string }> {
  const parsed = setLabelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "選び直してください。" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims)
    return { ok: false, message: "ログインし直してください。" };

  // 手入力の旅は編集画面で直すので、ここではタイムラインの外出だけ
  const { data: updated, error } = await supabase
    .from("outings")
    .update({
      label: parsed.data.label,
      label_confidence: null,
      label_source: "user",
    })
    .eq("id", parsed.data.id)
    .eq("source", "timeline")
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { ok: false, message: "直せませんでした。" };
  }
  refresh();
  return { ok: true, message: "" };
}

export type RejudgeResult = {
  ok: boolean;
  message: string;
};

// Jev への質問（判断の基準）を変えたあとに、聞き直す。
//   ・本人が確かめた外出：本人の答えはそのままに、Jev の答え（jev_*）だけ取り直す。
//     同じ外出で、質問を変える前と後の正解率を比べられる
//   ・まだ確かめていない Jev の判定：未判定に戻す（ボタンでもう一度判定すると、新しいルールと質問で決まる）
export async function rejudgeWithNewQuestions(): Promise<RejudgeResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims)
    return { ok: false, message: "ログインし直してください。" };

  let client: ReturnType<typeof createJevClient>;
  try {
    client = createJevClient();
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }

  const { error: resetError } = await supabase
    .from("outings")
    .update({ label: null, label_confidence: null, label_source: null })
    .eq("source", "timeline")
    .eq("label_source", "jev");
  if (resetError) return { ok: false, message: "未判定に戻せませんでした。" };

  const [{ data: regions }, { data: reviewed }] = await Promise.all([
    supabase.rpc("get_my_regions"),
    supabase
      .from("outings")
      .select(
        "id, started_at, ended_at, nights, distance_km, main_transport, features, visited_regions(region_code)",
      )
      .eq("source", "timeline")
      .eq("label_source", "user")
      .not("jev_label", "is", null),
  ]);
  const ctx = buildContext(regions ?? []);

  let done = 0;
  let firstError: unknown = null;
  await runWithLimit(reviewed ?? [], CONCURRENCY, async (outing) => {
    if (firstError) return;
    try {
      const parsed = outingFeaturesSchema.safeParse(outing.features);
      const result = await classifyOuting(
        client,
        {
          ...outing,
          features: parsed.success ? parsed.data : null,
          region_codes: outing.visited_regions.map((r) => r.region_code),
        },
        ctx,
      );
      const { error } = await supabase
        .from("outings")
        .update({
          jev_label: result.label,
          jev_confidence: result.confidence,
          jev_p_daily: result.pDaily,
          jev_p_homecoming: result.pHomecoming,
          jev_p_day_trip: result.pDayTrip,
        })
        .eq("id", outing.id);
      if (!error) done++;
    } catch (error) {
      firstError = error;
    }
  });

  refresh();
  if (firstError) {
    return {
      ok: false,
      message: `確かめた外出のうち ${done} 件を聞き直したところで止まりました。${describeError(firstError)}`,
    };
  }
  return {
    ok: true,
    message: `確かめた外出 ${done} 件を新しい質問で聞き直しました。まだ確かめていない外出は未判定に戻したので、マイページで判定し直してください。`,
  };
}
