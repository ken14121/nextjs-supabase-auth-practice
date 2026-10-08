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
import { evaluateJev, type ReviewedOuting } from "@/lib/jev/evaluate";
import {
  labelName,
  OUTING_LABEL_VALUES,
  type OutingLabel,
} from "@/lib/outings/labels";
import { createClient } from "@/lib/supabase/server";
import { outingFeaturesSchema } from "@/lib/timeline/features";

export const metadata = { title: "Jev の判定を確かめる" };

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

const isLabel = (v: string | null): v is OutingLabel =>
  (OUTING_LABEL_VALUES as readonly (string | null)[]).includes(v);

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

// Jev の判定を本人が確かめ、正解率と確率の当てはまりを見るページ
export default async function ReviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: outings } = await supabase
    .from("outings")
    .select(
      "id, started_at, ended_at, nights, distance_km, features, label, label_source, label_confidence, jev_label, jev_confidence, jev_p_daily, visited_regions(region_code)",
    )
    .not("jev_label", "is", null);

  const all = outings ?? [];
  // 本人が確かめたもの（合ってる・直した）
  const reviewed: ReviewedOuting[] = all.flatMap((o) =>
    o.label_source === "user" && isLabel(o.jev_label) && isLabel(o.label)
      ? [
          {
            jevLabel: o.jev_label,
            userLabel: o.label,
            jevConfidence: o.jev_confidence,
            jevPDaily: o.jev_p_daily,
          },
        ]
      : [],
  );
  // まだ確かめていないものから、偏りが出ないようにでたらめに選ぶ
  //（要確認だけを見ると、正解率が実際より低く出てしまうため）
  const sample = all
    .filter((o) => o.label_source === "jev")
    .sort((a, b) => stableRandom(a.id) - stableRandom(b.id))
    .slice(0, SAMPLE_SIZE)
    // 選ぶのはでたらめ、見せる順番は昔から（思い出しやすいように）
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const waiting = all.filter((o) => o.label_source === "jev").length;

  const result = evaluateJev(reviewed);

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClipboardCheck className="size-6" />
              Jev の判定を確かめる
            </CardTitle>
            <CardDescription>
              Jev が判定した外出を、本人が「合ってる」か選び直すことで、Jev
              がどれくらい当たっているかを数えます。
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
            <RejudgeButton />
            {result.total < ENOUGH_REVIEWS && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                確かめた件数が少ないうちは、数字が大きくぶれます（目安は{" "}
                {ENOUGH_REVIEWS} 件以上）。
              </p>
            )}

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
                    <th className="py-1.5 font-medium">実際に日常だった割合</th>
                  </tr>
                </thead>
                <tbody>
                  {result.dailyCalibration.map((bin) => (
                    <tr key={bin.from} className="border-b last:border-0">
                      <td className="py-1.5">
                        {Math.round(bin.from * 100)}〜{Math.round(bin.to * 100)}
                        %
                      </td>
                      <td className="py-1.5">{bin.count}</td>
                      <td className="py-1.5">{percent(bin.meanPredicted)}</td>
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
                確かめる外出はありません。マイページで Jev
                に判定させると、ここに出ます。
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
