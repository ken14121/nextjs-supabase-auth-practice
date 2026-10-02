"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptFriendRequest, removeFriendship } from "./actions";

// 届いた申請：承認 / 断る
export function IncomingRequestButtons({
  requesterId,
}: {
  requesterId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const res = await action();
      setError(res.ok ? null : res.message);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => run(() => acceptFriendRequest(requesterId))}
        >
          <Check />
          承認
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => removeFriendship(requesterId))}
        >
          断る
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// 送った申請の取り消し・友達をやめる。間違えないよう、1 回目で確認を出す
export function RemoveFriendshipButton({
  otherId,
  label,
  confirmText,
}: {
  otherId: string;
  label: string;
  confirmText: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        <X />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <span>{confirmText}</span>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removeFriendship(otherId);
          })
        }
      >
        はい
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        やめる
      </Button>
    </div>
  );
}
