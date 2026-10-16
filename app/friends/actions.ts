"use server";

import { revalidatePath } from "next/cache";
import { addFriendSchema, userIdSchema } from "@/lib/friends/schema";
import { createClient } from "@/lib/supabase/server";

export type FriendActionResult = { ok: boolean; message: string };

// 友達申請まわりの Server Action。
// 誰が何をしてよいかは DB の RLS が守っている（自分が関係する申請しか見えない・
// 承認できるのは申請された側だけ）。ここでは分かりやすいメッセージを返す役目。

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub ?? null };
}

const LOGIN_AGAIN: FriendActionResult = {
  ok: false,
  message: "ログインし直してから、もう一度お試しください。",
};

// 自分と相手の組み合わせ（どちらが申請したかは問わない）を探す条件
function pairFilter(me: string, other: string) {
  return `and(requester_id.eq.${me},addressee_id.eq.${other}),and(requester_id.eq.${other},addressee_id.eq.${me})`;
}

export async function sendFriendRequest(
  input: unknown,
): Promise<FriendActionResult> {
  const parsed = addFriendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "フレンドコードは 8 文字の英数字です。" };
  }
  const { supabase, userId } = await currentUser();
  if (!userId) return LOGIN_AGAIN;

  // コードから相手を探す（自分のコードでは見つからない）
  const { data: found } = await supabase.rpc("find_profile_by_friend_code", {
    code: parsed.data.code,
  });
  const other = found?.[0];
  if (!other) {
    return {
      ok: false,
      message:
        "このフレンドコードの人は見つかりませんでした（自分のコードは使えません）。",
    };
  }
  const name = other.display_name || "名前未設定の人";

  const { data: existing } = await supabase
    .from("friendships")
    .select("requester_id, status")
    .or(pairFilter(userId, other.id))
    .maybeSingle();

  if (existing?.status === "accepted") {
    return { ok: false, message: `${name}さんとはもう友達です。` };
  }
  if (existing && existing.requester_id === userId) {
    return { ok: false, message: `${name}さんにはもう申請しています。` };
  }
  if (existing) {
    // 相手からの申請が届いていたら、そのまま承認する
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", other.id)
      .eq("addressee_id", userId);
    if (error) {
      return { ok: false, message: "承認できませんでした。" };
    }
    revalidatePath("/friends");
    return {
      ok: true,
      message: `${name}さんからの申請を承認して、友達になりました。`,
    };
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: userId, addressee_id: other.id });
  if (error) {
    return {
      ok: false,
      message: "申請できませんでした。もう一度お試しください。",
    };
  }
  revalidatePath("/friends");
  return {
    ok: true,
    message: `${name}さんに友達申請を送りました。承認されると友達になります。`,
  };
}

export async function acceptFriendRequest(
  requesterId: string,
): Promise<FriendActionResult> {
  const parsedId = userIdSchema.safeParse(requesterId);
  if (!parsedId.success)
    return { ok: false, message: "申請が見つかりません。" };
  const { supabase, userId } = await currentUser();
  if (!userId) return LOGIN_AGAIN;

  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", parsedId.data)
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .select("requester_id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "承認できませんでした。" };
  }
  revalidatePath("/friends");
  return { ok: true, message: "友達になりました。" };
}

// 申請の取り消し・断る・友達をやめる、はどれも「2 人の行を消す」
export async function removeFriendship(
  otherId: string,
): Promise<FriendActionResult> {
  const parsedId = userIdSchema.safeParse(otherId);
  if (!parsedId.success) return { ok: false, message: "見つかりません。" };
  const { supabase, userId } = await currentUser();
  if (!userId) return LOGIN_AGAIN;

  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(pairFilter(userId, parsedId.data));
  if (error) {
    return { ok: false, message: "うまくいきませんでした。" };
  }
  revalidatePath("/friends");
  return { ok: true, message: "" };
}
