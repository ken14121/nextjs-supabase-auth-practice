"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { airportDistanceKm, isKnownAirport } from "@/lib/geo/airports";
import { isStation, stationDistanceKm } from "@/lib/geo/shinkansen";
import { PASS_DESIGNS, type PassDesign } from "@/lib/outings/boarding-pass";
import { RAIL_DESIGNS, type RailDesign } from "@/lib/outings/rail-ticket";
import {
  TICKET_KINDS,
  type TicketKind,
  TRIP_DESIGNS,
  type TripDesign,
} from "@/lib/outings/ticket";
import { compactStyle, ticketStyleSchema } from "@/lib/outings/ticket-style";
import { createClient } from "@/lib/supabase/server";
import { legSchema, legTimes } from "@/lib/trips/legs";
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

const airportCode = z.string().regex(/^[A-Z]{3}$/);

const ticketLookSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("flight"),
    id: z.uuid(),
    design: z.enum(
      PASS_DESIGNS.map((d) => d.value) as [PassDesign, ...PassDesign[]],
    ),
    style: ticketStyleSchema,
    // 本人が直した空港（直していなければ無し）
    airports: z.object({ from: airportCode, to: airportCode }).optional(),
  }),
  z.object({
    kind: z.literal("ride"),
    id: z.uuid(),
    design: z.enum(
      RAIL_DESIGNS.map((d) => d.value) as [RailDesign, ...RailDesign[]],
    ),
    style: ticketStyleSchema,
  }),
  z.object({
    kind: z.literal("ground"),
    id: z.uuid(),
    design: z.enum(
      RAIL_DESIGNS.map((d) => d.value) as [RailDesign, ...RailDesign[]],
    ),
    style: ticketStyleSchema,
  }),
  z.object({
    kind: z.literal("trip"),
    id: z.uuid(),
    design: z.enum(
      TRIP_DESIGNS.map((d) => d.value) as [TripDesign, ...TripDesign[]],
    ),
    // 切符の種類（null なら自動）
    ticketKind: z
      .enum(
        TICKET_KINDS.map((k) => k.key) as [
          TicketKind["key"],
          ...TicketKind["key"][],
        ],
      )
      .nullable(),
    style: ticketStyleSchema,
  }),
]);

type SaveResult = { ok: true } | { ok: false; message: string };
const NOT_SAVED: SaveResult = { ok: false, message: "保存できませんでした" };

// 切符の見た目（デザイン・差し色・マーク・絵文字・はんこ）を保存する。
// 搭乗券は空港も、旅の切符は種類も直せる。本人の行だけ（RLS）。ほかの列は変えられない（列ごとの権限）
export async function saveTicketLook(input: unknown): Promise<SaveResult> {
  const parsed = ticketLookSchema.safeParse(input);
  if (!parsed.success) return NOT_SAVED;
  const look = parsed.data;
  const style = compactStyle(look.style);
  const supabase = await createClient();

  if (look.kind === "trip") {
    const { data, error } = await supabase
      .from("outings")
      .update({
        ticket_design: look.design,
        ticket_kind: look.ticketKind,
        ticket_style: style,
      })
      .eq("id", look.id)
      .select("id");
    if (error || !data?.length) return NOT_SAVED;
    revalidatePath("/trips");
    return { ok: true };
  }

  if (look.kind === "ride" || look.kind === "ground") {
    const { data, error } = await supabase
      .from(look.kind === "ride" ? "train_rides" : "ground_legs")
      .update({ design: look.design, style })
      .eq("id", look.id)
      .select("id");
    if (error || !data?.length) return NOT_SAVED;
    revalidatePath("/trips");
    return { ok: true };
  }

  let airportFields = {};
  if (look.airports) {
    const { from, to } = look.airports;
    if (!isKnownAirport(from) || !isKnownAirport(to)) {
      return {
        ok: false,
        message: "知らない空港コードです。コード（例：HND）を確かめてください",
      };
    }
    // 距離は、記録の距離と空港どうしの直線距離の長い方（機内で記録が途切れると短く出るため）
    const { data: current } = await supabase
      .from("flights")
      .select("distance_km")
      .eq("id", look.id)
      .single();
    const between = airportDistanceKm(from, to) ?? 0;
    airportFields = {
      from_airport: from,
      to_airport: to,
      airports_fixed: true,
      distance_km:
        Math.round(Math.max(Number(current?.distance_km ?? 0), between) * 10) /
        10,
    };
  }
  const { data, error } = await supabase
    .from("flights")
    .update({ design: look.design, style, ...airportFields })
    .eq("id", look.id)
    .select("id");
  if (error || !data?.length) return NOT_SAVED;
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

// 旅に、飛行機の便・新幹線の乗車を手で足す（本人の旅にだけ。RLS の insert の条件で確かめる）
export async function addLeg(input: unknown): Promise<SaveResult> {
  const parsed = legSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "入力を確かめてください",
    };
  }
  const leg = parsed.data;
  const { departedAt, arrivedAt, hasTimes } = legTimes(
    leg.date,
    leg.depTime,
    leg.arrTime,
    leg.endDate,
  );
  const supabase = await createClient();

  if (leg.kind === "ground") {
    const { error } = await supabase.from("ground_legs").insert({
      outing_id: leg.outingId,
      mode: leg.mode,
      from_name: leg.from,
      to_name: leg.to,
      departed_at: departedAt,
      arrived_at: arrivedAt,
      has_times: hasTimes,
    });
    if (error) return NOT_SAVED;
  } else if (leg.kind === "flight") {
    if (!isKnownAirport(leg.from) || !isKnownAirport(leg.to)) {
      return {
        ok: false,
        message: "知らない空港コードです。コード（例：NRT）を確かめてください",
      };
    }
    const km = airportDistanceKm(leg.from, leg.to) ?? 0;
    const { error } = await supabase.from("flights").insert({
      outing_id: leg.outingId,
      departed_at: departedAt,
      arrived_at: arrivedAt,
      from_airport: leg.from,
      to_airport: leg.to,
      distance_km: Math.round(km * 10) / 10,
      added_by_user: true,
      has_times: hasTimes,
      airports_fixed: true,
    });
    if (error) return NOT_SAVED;
  } else {
    if (!isStation(leg.from) || !isStation(leg.to)) return NOT_SAVED;
    const km = stationDistanceKm(leg.from, leg.to) ?? 0;
    const { error } = await supabase.from("train_rides").insert({
      outing_id: leg.outingId,
      departed_at: departedAt,
      arrived_at: arrivedAt,
      from_station: leg.from,
      to_station: leg.to,
      distance_km: Math.round(km * 10) / 10,
      added_by_user: true,
      has_times: hasTimes,
    });
    if (error) return NOT_SAVED;
  }
  revalidatePath("/trips");
  return { ok: true };
}

const removeLegSchema = z.object({
  kind: z.enum(["flight", "ride", "ground"]),
  id: z.uuid(),
});

// 手で足した便・乗車を消す（タイムラインから作ったものは消さない）
export async function removeLeg(input: unknown): Promise<SaveResult> {
  const parsed = removeLegSchema.safeParse(input);
  if (!parsed.success) return NOT_SAVED;
  const supabase = await createClient();
  const { kind, id } = parsed.data;
  // バスなどは全部本人が足したもの。便・新幹線は、手で足したものだけ消せる
  const { data, error } =
    kind === "ground"
      ? await supabase.from("ground_legs").delete().eq("id", id).select("id")
      : await supabase
          .from(kind === "flight" ? "flights" : "train_rides")
          .delete()
          .eq("id", id)
          .eq("added_by_user", true)
          .select("id");
  if (error || !data?.length) return NOT_SAVED;
  revalidatePath("/trips");
  return { ok: true };
}
