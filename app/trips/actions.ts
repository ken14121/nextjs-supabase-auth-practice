"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PASS_DESIGNS, type PassDesign } from "@/lib/outings/boarding-pass";
import { RAIL_DESIGNS, type RailDesign } from "@/lib/outings/rail-ticket";
import { compactStyle, ticketStyleSchema } from "@/lib/outings/ticket-style";
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

const ticketLookSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("flight"),
    id: z.uuid(),
    design: z.enum(
      PASS_DESIGNS.map((d) => d.value) as [PassDesign, ...PassDesign[]],
    ),
    style: ticketStyleSchema,
  }),
  z.object({
    kind: z.literal("ride"),
    id: z.uuid(),
    design: z.enum(
      RAIL_DESIGNS.map((d) => d.value) as [RailDesign, ...RailDesign[]],
    ),
    style: ticketStyleSchema,
  }),
]);

// 搭乗券・新幹線の切符の見た目（デザイン・差し色・マーク・絵文字・はんこ）を保存する。
// 本人の便・乗車だけ（RLS）。見た目以外の列は変えられない（列ごとの権限）
export async function saveTicketLook(input: unknown): Promise<{ ok: boolean }> {
  const parsed = ticketLookSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { kind, id, design } = parsed.data;
  const style = compactStyle(parsed.data.style);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(kind === "flight" ? "flights" : "train_rides")
    .update({ design, style })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath("/trips");
  return { ok: true };
}

const boardingPassSchema = z.object({
  id: z.uuid(),
  airline: z.string().regex(/^[A-Z0-9]{2,3}$/),
  flightNumber: z.string().regex(/^\d{1,4}[A-Z]?$/),
  seat: z
    .string()
    .regex(/^\d{1,3}[A-Z]$/)
    .nullable(),
});

// 搭乗券のバーコードから読んだ航空会社・便名・座席を、便に足す。
// 名前と予約番号はブラウザで読み飛ばしているので、ここには届かない
export async function attachBoardingPass(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = boardingPassSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flights")
    .update({
      airline: parsed.data.airline,
      flight_number: parsed.data.flightNumber,
      seat: parsed.data.seat,
    })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePath("/trips");
  return { ok: true };
}
