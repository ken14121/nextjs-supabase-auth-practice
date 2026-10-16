"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteTrip } from "./actions";

// 間違って消さないよう、1 回目の押下で確認を出し、2 回目で削除する
export function DeleteTripButton({ tripId }: { tripId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        className="text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
        この旅を削除
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 p-3 text-sm">
      <span>この旅を削除します。元には戻せません。</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => deleteTrip(tripId))}
      >
        削除する
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setConfirming(false)}
      >
        やめる
      </Button>
    </div>
  );
}
