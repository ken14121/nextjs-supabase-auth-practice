import { z } from "zod";

// 飛行機・新幹線のほかに足せる移動（出発地・到着地は本人が書いた名前）
export const GROUND_MODES = [
  { value: "bus", label: "バス", title: "バス乗車券", stamp: "乗車記念" },
  { value: "train", label: "在来線", title: "乗車券", stamp: "乗車記念" },
  { value: "boat", label: "船", title: "乗船券", stamp: "乗船記念" },
  { value: "car", label: "車", title: "ドライブ", stamp: "ドライブ記念" },
] as const;
export type GroundMode = (typeof GROUND_MODES)[number]["value"];
export const isGroundMode = (v: unknown): v is GroundMode =>
  GROUND_MODES.some((m) => m.value === v);
export const groundMode = (mode: GroundMode) =>
  GROUND_MODES.find((m) => m.value === mode) ?? GROUND_MODES[0];

const placeName = (message: string) =>
  z.string().trim().min(1, message).max(30, "名前は 30 文字までです");

// 旅に、飛行機の便・新幹線の乗車・バスなどの移動を本人が手で足すときの入力。
// 時刻は分からなければ空でよい（そのときは日付だけの搭乗券・切符になる）

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入れてください");
const time = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "時刻は 08:30 のように入れてください");

const base = {
  outingId: z.uuid(),
  date,
  // 何日かかけた移動の、終わりの日（バスで 5 日間めぐった など）。1 日だけなら空
  endDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "終わりの日を入れてください")
    .default(""),
  depTime: time,
  arrTime: time,
};

export const legSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("flight"),
      ...base,
      from: z
        .string()
        .regex(/^[A-Z]{3}$/, "空港はコード（例：NRT）で入れてください"),
      to: z
        .string()
        .regex(/^[A-Z]{3}$/, "空港はコード（例：OKA）で入れてください"),
    }),
    z.object({
      kind: z.literal("ride"),
      ...base,
      from: z.string().regex(/^[a-z-]{2,40}$/, "乗った駅を選んでください"),
      to: z.string().regex(/^[a-z-]{2,40}$/, "降りた駅を選んでください"),
    }),
    z.object({
      kind: z.literal("ground"),
      mode: z.enum(
        GROUND_MODES.map((m) => m.value) as [GroundMode, ...GroundMode[]],
      ),
      ...base,
      from: placeName("出発した場所を入れてください"),
      to: placeName("着いた場所を入れてください"),
    }),
  ])
  .refine((v) => v.from !== v.to, {
    message: "出発と到着が同じです",
    path: ["to"],
  })
  .refine((v) => v.endDate === "" || v.endDate >= v.date, {
    message: "終わりの日は、始まりの日より後にしてください",
    path: ["endDate"],
  })
  .refine((v) => (v.depTime === "") === (v.arrTime === ""), {
    message: "時刻は、出発と到着の両方を入れるか、両方とも空にしてください",
    path: ["arrTime"],
  });

export type LegValues = z.infer<typeof legSchema>;

// 日付と時刻（日本時間）から、出発・到着の日時を作る。
// 終わりの日があれば、その日に着いたとする。同じ日で、到着が出発より前の時刻なら、次の日に着いたとみなす。
// 時刻が無ければ、その日の 0:00 にする
export function legTimes(
  dateText: string,
  depTime: string,
  arrTime: string,
  endDateText = "",
): { departedAt: string; arrivedAt: string; hasTimes: boolean } {
  const endText = endDateText || dateText;
  if (!depTime || !arrTime) {
    return {
      departedAt: new Date(`${dateText}T00:00:00+09:00`).toISOString(),
      arrivedAt: new Date(`${endText}T00:00:00+09:00`).toISOString(),
      hasTimes: false,
    };
  }
  const dep = new Date(`${dateText}T${depTime}:00+09:00`);
  const arr = new Date(`${endText}T${arrTime}:00+09:00`);
  if (arr < dep) arr.setUTCDate(arr.getUTCDate() + 1);
  return {
    departedAt: dep.toISOString(),
    arrivedAt: arr.toISOString(),
    hasTimes: true,
  };
}
