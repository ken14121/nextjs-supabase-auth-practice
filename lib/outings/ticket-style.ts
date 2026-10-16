import { z } from "zod";

// 搭乗券・新幹線の切符を、本人が飾るための設定。
//   accent：差し色（帯・行き先の文字・はんこの色）
//   mark：帯に出すマーク
//   emoji：切符に載せる絵文字（3 つまで）
//   stamp：はんこの文字（8 文字まで）

export const TICKET_MARKS = [
  { value: "plane", label: "飛行機" },
  { value: "train", label: "電車" },
  { value: "heart", label: "ハート" },
  { value: "star", label: "星" },
  { value: "sparkles", label: "きらきら" },
  { value: "sun", label: "太陽" },
  { value: "moon", label: "月" },
  { value: "mountain", label: "山" },
  { value: "waves", label: "海" },
  { value: "flower", label: "花" },
  { value: "camera", label: "カメラ" },
  { value: "coffee", label: "コーヒー" },
  { value: "music", label: "音楽" },
  { value: "pin", label: "ピン" },
] as const;

export type TicketMark = (typeof TICKET_MARKS)[number]["value"];

// 色を選ぶときのおすすめ
export const ACCENT_PRESETS = [
  "#c8432c",
  "#d9822b",
  "#c9a227",
  "#2e7d55",
  "#2f5d8a",
  "#6d4aa8",
  "#c2457a",
  "#1d1c1a",
];

const MAX_EMOJI = 3;
const MAX_STAMP = 8;

// 見た目の文字のまとまり（絵文字は 1 つでも複数の文字でできていることがある）で数える
function graphemes(text: string): string[] {
  return [
    ...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text),
  ].map((s) => s.segment);
}

export const ticketStyleSchema = z
  .object({
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((v) => v.toLowerCase())
      .optional(),
    mark: z
      .enum(TICKET_MARKS.map((m) => m.value) as [TicketMark, ...TicketMark[]])
      .optional(),
    emoji: z
      .string()
      .trim()
      .refine(
        (v) => {
          const parts = graphemes(v);
          return (
            parts.length <= MAX_EMOJI &&
            parts.every((p) =>
              /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(p),
            )
          );
        },
        { message: `絵文字だけを ${MAX_EMOJI} つまで入れてください` },
      )
      .optional(),
    stamp: z
      .string()
      .trim()
      .refine((v) => graphemes(v).length <= MAX_STAMP, {
        message: `はんこの文字は ${MAX_STAMP} 文字までです`,
      })
      .optional(),
  })
  .strict();

export type TicketStyle = z.infer<typeof ticketStyleSchema>;

// DB から読んだ style を確かめる（形がおかしければ、飾りなしとして扱う）
export function readTicketStyle(value: unknown): TicketStyle {
  const parsed = ticketStyleSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

// 空の項目を消して、保存する形にする
export function compactStyle(style: TicketStyle): TicketStyle {
  return Object.fromEntries(
    Object.entries(style).filter(([, v]) => v !== undefined && v !== ""),
  ) as TicketStyle;
}

// 背景の色に対して、読みやすい文字の色（明るい色の上は墨、暗い色の上は白）。
// 境目は、元のデザインの帯（ベージュ・橙）が白い文字のままになるところ
export function readableOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? "#1d1c1a" : "#ffffff";
}

// はんこの文字を、丸いはんこに収まるように 2 行に分ける（2 文字までは 1 行）。
// 「乗車記念」→「乗車」「記念」、「北海道旅行」→「北海道」「旅行」
export function stampLines(text: string): string[] {
  const chars = graphemes(text);
  if (chars.length <= 2) return chars.length ? [chars.join("")] : [];
  const half = Math.ceil(chars.length / 2);
  return [chars.slice(0, half).join(""), chars.slice(half).join("")];
}
