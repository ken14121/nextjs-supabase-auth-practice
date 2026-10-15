import { z } from "zod";

// 旅に、飛行機の便・新幹線の乗車を本人が手で足すときの入力。
// 時刻は分からなければ空でよい（そのときは日付だけの搭乗券・切符になる）

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入れてください");
const time = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "時刻は 08:30 のように入れてください");

const base = {
  outingId: z.uuid(),
  date,
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
  ])
  .refine((v) => v.from !== v.to, {
    message: "出発と到着が同じです",
    path: ["to"],
  })
  .refine((v) => (v.depTime === "") === (v.arrTime === ""), {
    message: "時刻は、出発と到着の両方を入れるか、両方とも空にしてください",
    path: ["arrTime"],
  });

export type LegValues = z.infer<typeof legSchema>;

// 日付と時刻（日本時間）から、出発・到着の日時を作る。
// 到着が出発より前の時刻なら、次の日に着いたとみなす。時刻が無ければ、その日の 0:00 にする
export function legTimes(
  dateText: string,
  depTime: string,
  arrTime: string,
): { departedAt: string; arrivedAt: string; hasTimes: boolean } {
  if (!depTime || !arrTime) {
    const at = new Date(`${dateText}T00:00:00+09:00`).toISOString();
    return { departedAt: at, arrivedAt: at, hasTimes: false };
  }
  const dep = new Date(`${dateText}T${depTime}:00+09:00`);
  const arr = new Date(`${dateText}T${arrTime}:00+09:00`);
  if (arr < dep) arr.setUTCDate(arr.getUTCDate() + 1);
  return {
    departedAt: dep.toISOString(),
    arrivedAt: arr.toISOString(),
    hasTimes: true,
  };
}
