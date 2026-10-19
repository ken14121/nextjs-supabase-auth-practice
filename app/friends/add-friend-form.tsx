"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { type AddFriendInput, addFriendSchema } from "@/lib/friends/schema";
import { type FriendActionResult, sendFriendRequest } from "./actions";

// フレンドコードを入れて友達申請するフォーム（react-hook-form + Zod）
export function AddFriendForm() {
  const [result, setResult] = useState<FriendActionResult | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddFriendInput>({
    resolver: zodResolver(addFriendSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (values: AddFriendInput) => {
    setResult(null);
    const res = await sendFriendRequest(values);
    setResult(res);
    if (res.ok) reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
      <Label htmlFor="friend-code">友達のフレンドコード</Label>
      <div className="flex gap-2">
        <Input
          id="friend-code"
          placeholder="例: 1a2b3c4d"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          className="font-mono tracking-wider"
          aria-invalid={!!errors.code}
          aria-describedby="friend-code-message"
          {...register("code")}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
          申請
        </Button>
      </div>
      <p id="friend-code-message" className="text-sm" aria-live="polite">
        {errors.code ? (
          <span className="text-destructive">{errors.code.message}</span>
        ) : result ? (
          <span className={result.ok ? "text-foreground" : "text-destructive"}>
            {result.message}
          </span>
        ) : null}
      </p>
    </form>
  );
}
