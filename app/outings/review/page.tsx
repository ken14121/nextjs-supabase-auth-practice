import { ArrowLeft, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelSelect } from "@/app/outings/label-select";
import { RejudgeButton } from "@/app/outings/rejudge-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { regionName } from "@/lib/geo/names";
import { isJevAllowed } from "@/lib/jev/classify";
import { DAILY_THRESHOLD } from "@/lib/jev/decide";
import {
  accuracyByDailyThreshold,
  evaluateJev,
  type ReviewedOuting,
} from "@/lib/jev/evaluate";
import { buildJevContext } from "@/lib/jev/state";
import {
  labelName,
  OUTING_LABEL_VALUES,
  type OutingLabel,
} from "@/lib/outings/labels";
import { evaluateRuleJudge, splitForReview } from "@/lib/outings/review";
import {
  OUTING_MINUTES,
  OUTING_MINUTES_OF,
  type RuleOptions,
} from "@/lib/outings/rule-judge";
import { createClient } from "@/lib/supabase/server";
import { isClearlyDaily, outingFeaturesSchema } from "@/lib/timeline/features";

export const metadata = { title: "判定を確かめる" };

// おでかけの境目の候補（分）
const OUTING_MINUTE_CANDIDATES = [30, 45, 60, 90, 120, 180];

// 1 回に確かめる件数
const SAMPLE_SIZE = 20;
// これより少ないうちは、数字がぶれやすいと注意を出す
const ENOUGH_REVIEWS = 50;

const timeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
});

// 思い出す手がかりに、いつもの場所 / ふだん行かない場所にいた時間を出す
function StayNote({ features }: { features: unknown }) {
  const parsed = outingFeaturesSchema.safeParse(features);
  if (!parsed.success) return null;
  const f = parsed.data;
  const h = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} 時間`;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      いつもの場所 {h(f.frequentMinutes)}・ふだん行かない場所 {h(f.rareMinutes)}
      ・自宅から最大 {Math.round(f.maxKmFromHome)} km
    </span>
  );
}

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

// ID から決まる、でたらめだが毎回同じ並び順（確かめるたびに一覧が並び替わらないように）
function stableRandom(id: string): number {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const percent = (v: number | null) =>
  v === null ? "―" : `${Math.round(v * 100)}%`;

// 判定を本人が確かめ、正解率を見るページ。
// Jev を使える人（本人）は Jev の答えと確率の当てはまりを、それ以外の人はアプリのルールの答えを確かめる
export default async function ReviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");
  const jev = isJevAllowed(data.claims.sub);

  const outingsQuery = supabase
    .from("outings")
    .select(
      "id, started_at, ended_at, nights, distance_km, features, label, label_source, label_confidence, jev_label, jev_confidence, jev_p_daily, jev_p_homecoming, jev_p_day_trip, visited_regions(region_code)",
    );
  const [{ data: outings }, { data: regions }, { data: settings }] =
    await Promise.all([
      jev
        ? outingsQuery.not("jev_label", "is", null)
        : outingsQuery.eq("source", "timeline").not("label", "is", null),
      supabase.rpc("get_my_regions"),
      supabase.from("judge_settings").select("homecoming").maybeSingle(),
    ]);

  // 本人が確かめたもの（合ってる・直した）と、まだのもの
  const { reviewed: reviewedRows, unchecked } = splitForReview(
    outings ?? [],
    jev,
  );
  // Jev の答えと比べるのは、Jev を使える人だけ
  const reviewed: ReviewedOuting[] = jev
    ? reviewedRows.map((o) => ({
        jevLabel: o.jev_label as OutingLabel,
        userLabel: o.label as OutingLabel,
        jevConfidence: o.jev_confidence,
        jevPDaily: o.jev_p_daily,
      }))
    : [];
  // アプリの実際の流れ（Jev に聞く前に、いつもの場所だけ・家の近くだけの日はルールで日常にする）
  // で判定していたら、何件当たっていたか
  const byRule = reviewedRows.map((o) => {
    const features = outingFeaturesSchema.safeParse(o.features);
    return features.success && isClearlyDaily(o.nights, features.data);
  });
  const withRule = evaluateJev(
    reviewed.map((r, i) => (byRule[i] ? { ...r, jevLabel: "daily" } : r)),
  );
  const ruleCount = byRule.filter(Boolean).length;
  // Jev を使わず、ルールだけで判定していたら（Jev が使えないときの代わり。lib/outings/rule-judge.ts）
  const ctx = buildJevContext(regions ?? [], settings);
  const ruleInputs = reviewedRows.map((o) => {
    const features = outingFeaturesSchema.safeParse(o.features);
    return {
      started_at: o.started_at,
      ended_at: o.ended_at,
      nights: o.nights,
      distance_km: Number(o.distance_km),
      region_codes: o.visited_regions.map((r) => r.region_code),
      features: features.success ? features.data : null,
    };
  });
  const evaluateRules = (options?: RuleOptions) =>
    evaluateRuleJudge(
      ruleInputs.map((r, i) => ({
        ...r,
        userLabel: reviewedRows[i].label as OutingLabel,
      })),
      ctx,
      options,
    );
  const ruleOnly = evaluateRules();
  // おでかけの境目を変えたら（どの時間で見るか × 何分以上か）
  const outingSweep = (["rare", "notUsual"] as const).map((of) => ({
    of,
    cells: OUTING_MINUTE_CANDIDATES.map((minutes) => ({
      minutes,
      accuracy: evaluateRules({ outingMinutes: minutes, outingMinutesOf: of })
        .accuracy,
    })),
  }));
  // 「日常」の境目を変えたら（3 つの確率がそろっている外出だけで計算する）
  const thresholdRows = reviewedRows.flatMap((o, i) =>
    jev &&
    o.jev_p_daily !== null &&
    o.jev_p_homecoming !== null &&
    o.jev_p_day_trip !== null
      ? [
          {
            userLabel: o.label as OutingLabel,
            nights: o.nights,
            pDaily: o.jev_p_daily,
            pHomecoming: o.jev_p_homecoming,
            pDayTrip: o.jev_p_day_trip,
            byRule: byRule[i],
          },
        ]
      : [],
  );
  const thresholds = accuracyByDailyThreshold(
    thresholdRows,
    [0.3, 0.35, 0.4, 0.45, 0.5, 0.6],
  );
  // まだ確かめていないものから、偏りが出ないようにでたらめに選ぶ
  //（要確認だけを見ると、正解率が実際より低く出てしまうため）
  const sample = unchecked
    .toSorted((a, b) => stableRandom(a.id) - stableRandom(b.id))
    .slice(0, SAMPLE_SIZE)
    // 選ぶのはでたらめ、見せる順番は昔から（思い出しやすいように）
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const waiting = unchecked.length;

  // 上の大きな数字：Jev を使える人は Jev の正解率、それ以外の人はルールの正解率
  const result = jev ? evaluateJev(reviewed) : ruleOnly;

  return (
    <main className="flex flex-1 justify-center px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClipboardCheck className="size-6" />
              {jev ? "Jev の判定を確かめる" : "判定を確かめる"}
            </CardTitle>
            <CardDescription>
              {jev
                ? "Jev が判定した外出を、本人が「合ってる」か選び直すことで、Jev がどれくらい当たっているかを数えます。"
                : "アプリのルールで判定した外出を、本人が「合ってる」か選び直すことで、ルールがどれくらい当たっているかを数えます。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">正解率</dt>
                <dd className="text-3xl font-semibold tabular-nums">
                  {percent(result.accuracy)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">確かめた</dt>
                <dd className="text-3xl font-semibold tabular-nums">
                  {result.total}
                  <span className="text-sm text-muted-foreground"> 件</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">まだ</dt>
                <dd className="text-3xl font-semibold tabular-nums">
                  {waiting}
                  <span className="text-sm text-muted-foreground"> 件</span>
                </dd>
              </div>
            </dl>
            {jev && ruleCount > 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                アプリの実際の流れ（Jev
                に聞く前に、家の近くだけ・いつもの場所だけの日はルールで日常にする）だと、正解率は{" "}
                <b className="tabular-nums">{percent(withRule.accuracy)}</b>
                （確かめた {result.total} 件のうち {ruleCount}{" "}
                件がルールで決まる）。
              </p>
            )}
            {result.total > 0 && (
              <section className="flex flex-col gap-2 rounded-md border px-3 py-3">
                <h3 className="font-medium">
                  {jev
                    ? "Jev を使わず、ルールだけで判定したら"
                    : "ルールの答えと本人の答え"}
                </h3>
                {jev && (
                  <p className="text-sm">
                    正解率{" "}
                    <b className="text-xl tabular-nums">
                      {percent(ruleOnly.accuracy)}
                    </b>{" "}
                    <span className="text-muted-foreground">
                      （同じ {ruleOnly.total} 件。Jev とルールを合わせると{" "}
                      {percent(withRule.accuracy)}）
                    </span>
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-1.5 text-left font-medium">
                          ルール ＼ 本人
                        </th>
                        {OUTING_LABEL_VALUES.map((l) => (
                          <th key={l} className="py-1.5 font-medium">
                            {labelName(l)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {OUTING_LABEL_VALUES.map((rule) => (
                        <tr key={rule} className="border-b last:border-0">
                          <td className="py-1.5">{labelName(rule)}</td>
                          {OUTING_LABEL_VALUES.map((user) => (
                            <td
                              key={user}
                              className={
                                rule === user
                                  ? "py-1.5 text-center font-semibold"
                                  : "py-1.5 text-center text-muted-foreground"
                              }
                            >
                              {ruleOnly.confusion[rule][user]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h4 className="mt-2 text-sm font-medium">
                  おでかけの境目を変えたら
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-1.5 text-left font-medium">
                          見る時間 ＼ 何分以上
                        </th>
                        {OUTING_MINUTE_CANDIDATES.map((m) => (
                          <th key={m} className="py-1.5 font-medium">
                            {m} 分
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {outingSweep.map((row) => (
                        <tr key={row.of} className="border-b last:border-0">
                          <td className="py-1.5">
                            {row.of === "rare"
                              ? "ふだん行かない場所"
                              : "いつもの場所以外ぜんぶ"}
                          </td>
                          {row.cells.map((c) => (
                            <td
                              key={c.minutes}
                              className={
                                row.of === OUTING_MINUTES_OF &&
                                c.minutes === OUTING_MINUTES
                                  ? "py-1.5 text-center font-semibold underline underline-offset-4"
                                  : "py-1.5 text-center"
                              }
                            >
                              {percent(c.accuracy)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  下線が今の設定。確かめた件数が少ないので、一番高いところだけでなく、まわりも高い安定したところを選びます。
                </p>
                <p className="text-xs text-muted-foreground">
                  Jev
                  が使えないとき（キーが無い・残高が無い）は、このルールで判定します。
                  ルールは本人が確かめた外出を見て決めているので、ほかの人のデータでは当たり方が変わることがあります。
                </p>
              </section>
            )}
            {jev && <RejudgeButton />}
            {result.total < ENOUGH_REVIEWS && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                確かめた件数が少ないうちは、数字が大きくぶれます（目安は{" "}
                {ENOUGH_REVIEWS} 件以上）。
              </p>
            )}

            {/* ここから下は Jev の確率を使うので、Jev を使える人だけ */}
            {jev && (
              <>
                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">「要確認」の当たり方</h3>
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1.5 font-medium">Jev の表示</th>
                        <th className="py-1.5 font-medium">確かめた件数</th>
                        <th className="py-1.5 font-medium">正解率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.bySureness.map((row) => (
                        <tr key={row.name} className="border-b last:border-0">
                          <td className="py-1.5">{row.name}</td>
                          <td className="py-1.5">{row.count}</td>
                          <td className="py-1.5">{percent(row.accuracy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground">
                    「要確認あり」の正解率が低ければ、要確認の目印がちゃんと役に立っています。
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">Jev の答えと本人の答え</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular-nums">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="py-1.5 text-left font-medium">
                            Jev ＼ 本人
                          </th>
                          {OUTING_LABEL_VALUES.map((l) => (
                            <th key={l} className="py-1.5 font-medium">
                              {labelName(l)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {OUTING_LABEL_VALUES.map((jev) => (
                          <tr key={jev} className="border-b last:border-0">
                            <th className="py-1.5 text-left font-medium">
                              {labelName(jev)}
                            </th>
                            {OUTING_LABEL_VALUES.map((user) => {
                              const n = result.confusion[jev][user];
                              return (
                                <td
                                  key={user}
                                  className={`py-1.5 text-center ${jev === user ? "font-semibold" : n > 0 ? "text-destructive" : "text-muted-foreground"}`}
                                >
                                  {n}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ななめの太字が当たり。それ以外の赤い数字は「Jev
                    が左の答えを出したが、本人は上の答えにした」件数です。
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">
                    確率の当てはまり（「日常か？」の質問）
                  </h3>
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1.5 font-medium">Jev が言った確率</th>
                        <th className="py-1.5 font-medium">件数</th>
                        <th className="py-1.5 font-medium">平均</th>
                        <th className="py-1.5 font-medium">
                          実際に日常だった割合
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.dailyCalibration.map((bin) => (
                        <tr key={bin.from} className="border-b last:border-0">
                          <td className="py-1.5">
                            {Math.round(bin.from * 100)}〜
                            {Math.round(bin.to * 100)}%
                          </td>
                          <td className="py-1.5">{bin.count}</td>
                          <td className="py-1.5">
                            {percent(bin.meanPredicted)}
                          </td>
                          <td className="py-1.5">{percent(bin.actualRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground">
                    確率が正しければ「平均」と「実際の割合」が近くなります。大きくずれていれば、Jev
                    の確率は数字どおりには信じられない、ということです。
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="font-medium">「日常」の境目を変えたら</h3>
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-1.5 font-medium">
                          日常の確率がこれ以上なら日常
                        </th>
                        <th className="py-1.5 font-medium">当たった件数</th>
                        <th className="py-1.5 font-medium">正解率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thresholds.map((row) => (
                        <tr
                          key={row.threshold}
                          className={`border-b last:border-0 ${row.threshold === DAILY_THRESHOLD ? "font-semibold" : ""}`}
                        >
                          <td className="py-1.5">
                            {Math.round(row.threshold * 100)}%
                            {row.threshold === DAILY_THRESHOLD && "（いま）"}
                          </td>
                          <td className="py-1.5">
                            {row.correct} / {thresholdRows.length}
                          </td>
                          <td className="py-1.5">{percent(row.accuracy)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground">
                    保存してある Jev の確率から計算しているので、Jev
                    には聞き直していません（ルールで日常になる外出も含めた、アプリの実際の流れの正解率）。確かめた件数が少ないうちは、たまたまの差に合わせすぎないよう注意。
                  </p>
                </section>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              確かめる（でたらめに選んだ {sample.length} 件・古い順）
            </CardTitle>
            <CardDescription>
              合っていれば「合ってる」、違っていれば正しい種類を選んでください。確かめたものは一覧から消え、上の数字に入ります。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sample.length > 0 ? (
              <ul className="divide-y text-sm">
                {sample.map((o) => (
                  <li key={o.id} className="flex flex-col gap-1 py-3">
                    <span className="font-medium">
                      {dateFormat.format(new Date(o.started_at))}
                      {o.nights > 0 && ` から ${o.nights} 泊`}
                      <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                        {timeFormat.format(new Date(o.started_at))}〜
                        {timeFormat.format(new Date(o.ended_at))}・
                        {o.distance_km} km
                      </span>
                    </span>
                    <StayNote features={o.features} />
                    <span className="text-muted-foreground">
                      {[...new Set(o.visited_regions.map((r) => r.region_code))]
                        .map(regionName)
                        .join(" → ") || "―"}
                    </span>
                    <LabelSelect
                      outingId={o.id}
                      label={o.label}
                      source={o.label_source}
                      confidence={o.label_confidence}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {jev
                  ? "確かめる外出はありません。マイページで Jev に判定させると、ここに出ます。"
                  : "確かめる外出はありません。「記録の整理」で判定すると、ここに出ます。"}
              </p>
            )}
          </CardContent>
        </Card>

        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>
      </div>
    </main>
  );
}
