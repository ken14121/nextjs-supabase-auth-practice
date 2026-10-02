import { z } from "zod";

// フレンドコード（8 文字の英数字）。大文字・前後の空白は許して、小文字にそろえる
export const friendCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[0-9a-f]{8}$/, "フレンドコードは 8 文字の英数字です");

export const addFriendSchema = z.object({ code: friendCodeSchema });
export type AddFriendInput = z.input<typeof addFriendSchema>;

export const userIdSchema = z.uuid();
