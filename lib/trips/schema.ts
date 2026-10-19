import { z } from "zod";

// 手入力の旅のフォーム。ブラウザ（react-hook-form）とサーバー（Server Action）で同じルールを使う

export const TRIP_KINDS = [
  { value: "trip", label: "旅行" },
  { value: "homecoming", label: "帰省" },
  { value: "day_trip", label: "日帰り" },
] as const;

const KIND_VALUES = ["trip", "homecoming", "day_trip"] as const;
export type TripKind = (typeof KIND_VALUES)[number];

const dateText = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付を選んでください");

// 日本時間での今日（YYYY-MM-DD）
export function todayInJapan(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const tripSchema = z
  .object({
    startDate: dateText,
    endDate: dateText,
    kind: z.enum(KIND_VALUES, { error: "種類を選んでください" }),
    regions: z
      .array(z.string().regex(/^[A-Z]{2}(-[0-9A-Z]{1,3})?$/))
      .min(1, "行った県・国を 1 つ以上選んでください")
      .max(60, "選べるのは 60 か所までです"),
    memo: z.string().trim().max(200, "メモは 200 文字までです"),
  })
  .superRefine((value, ctx) => {
    // 日付の形が正しくないときは、上の「日付を選んでください」だけを出す
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (
      !datePattern.test(value.startDate) ||
      !datePattern.test(value.endDate)
    ) {
      return;
    }
    if (value.startDate < "1950-01-01") {
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "1950 年以降の日付を選んでください",
      });
    }
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "帰った日は、出発した日と同じかそれより後にしてください",
      });
    }
    if (value.endDate > todayInJapan()) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "未来の日付は選べません",
      });
    }
    if (value.kind === "day_trip" && value.startDate !== value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "日帰りのときは、出発した日と帰った日を同じにしてください",
      });
    }
  });

export type TripInput = z.input<typeof tripSchema>;
export type TripValues = z.output<typeof tripSchema>;

// 何泊か（出発日と帰った日の差）
export function nightsBetween(startDate: string, endDate: string): number {
  const DAY = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY);
}
