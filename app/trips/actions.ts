"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nightsBetween, type TripValues, tripSchema } from "@/lib/trips/schema";

export type TripActionResult = { ok: false; message: string } | undefined;

// 手入力の旅を保存・更新・削除する Server Action。
// ブラウザでもチェックしているが、ここでも同じスキーマで必ずチェックする

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub ?? null };
}

function toOutingRow(trip: TripValues) {
  return {
    // 日本時間の出発日 0:00 〜 帰った日 23:59
    started_at: `${trip.startDate}T00:00:00+09:00`,
    ended_at: `${trip.endDate}T23:59:59+09:00`,
    nights: nightsBetween(trip.startDate, trip.endDate),
    label: trip.kind,
    label_source: "user",
    label_confidence: null,
    memo: trip.memo,
  };
}

function toRegionRows(userId: string, outingId: string, trip: TripValues) {
  return [...new Set(trip.regions)].map((code) => ({
    user_id: userId,
    outing_id: outingId,
    region_code: code,
    visited_on: trip.startDate,
  }));
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/trips");
}

export async function createTrip(input: unknown): Promise<TripActionResult> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "入力内容を確認してください。" };
  }
  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return {
      ok: false,
      message: "ログインし直してから、もう一度お試しください。",
    };
  }

  const { data: outing, error } = await supabase
    .from("outings")
    .insert({ ...toOutingRow(parsed.data), user_id: userId, source: "manual" })
    .select("id")
    .single();
  if (error || !outing) {
    return {
      ok: false,
      message: "保存できませんでした。もう一度お試しください。",
    };
  }

  const { error: regionError } = await supabase
    .from("visited_regions")
    .insert(toRegionRows(userId, outing.id, parsed.data));
  if (regionError) {
    // 県・国が保存できなかった旅は残さない
    await supabase.from("outings").delete().eq("id", outing.id);
    return {
      ok: false,
      message: "保存できませんでした。もう一度お試しください。",
    };
  }

  refresh();
  redirect("/trips");
}

export async function updateTrip(
  id: string,
  input: unknown,
): Promise<TripActionResult> {
  const parsed = tripSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "入力内容を確認してください。" };
  }
  const { supabase, userId } = await currentUserId();
  if (!userId) {
    return {
      ok: false,
      message: "ログインし直してから、もう一度お試しください。",
    };
  }

  // 手入力の旅だけ編集できる（取り込んだ外出は対象外）。RLS で自分の行しか変わらない
  const { data: updated, error } = await supabase
    .from("outings")
    .update(toOutingRow(parsed.data))
    .eq("id", id)
    .eq("source", "manual")
    .select("id");
  if (error || !updated || updated.length === 0) {
    return { ok: false, message: "この旅は編集できません。" };
  }

  // 県・国は消してから入れ直す
  const { error: deleteError } = await supabase
    .from("visited_regions")
    .delete()
    .eq("outing_id", id);
  const { error: insertError } = deleteError
    ? { error: deleteError }
    : await supabase
        .from("visited_regions")
        .insert(toRegionRows(userId, id, parsed.data));
  if (insertError) {
    return {
      ok: false,
      message: "行った県・国を保存できませんでした。もう一度お試しください。",
    };
  }

  refresh();
  redirect("/trips");
}

export async function deleteTrip(id: string): Promise<void> {
  const { supabase, userId } = await currentUserId();
  if (!userId) redirect("/");

  // 訪問地は outings を消すと一緒に消える（on delete cascade）
  await supabase.from("outings").delete().eq("id", id).eq("source", "manual");
  refresh();
  redirect("/trips");
}
