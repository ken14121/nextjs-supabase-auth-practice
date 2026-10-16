"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/app/auth/actions";

// アカウントとデータを全部消す。間違えて押さないよう、「削除」と打ってから消す
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-destructive"
      >
        アカウントとデータを削除
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-sm border border-destructive/40 p-3 text-sm">
      <p>
        アカウントと、取り込んだ外出・行った県・切符・友達とのつながりなど、すべてのデータを消します。
        <b>元に戻せません。</b>
      </p>
      <label className="flex flex-wrap items-center gap-2 text-xs">
        確かめるために「削除」と入力してください
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="h-8 w-24 rounded-sm border border-input bg-background px-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={typed !== "削除" || isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteMyAccount();
              setMessage(res.message);
            })
          }
          className="rounded-sm bg-destructive px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {isPending ? "削除しています…" : "すべて削除する"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          やめる
        </button>
      </div>
      {message && (
        <p role="status" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
