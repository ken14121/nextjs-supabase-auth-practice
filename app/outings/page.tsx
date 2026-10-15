import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassifyButton } from "@/app/outings/classify-button";
import { LabelSelect } from "@/app/outings/label-select";
import { regionName } from "@/lib/geo/names";
import { labelName } from "@/lib/outings/labels";
import { TRANSPORT_LABELS } from "@/lib/outings/transport";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "記録の整理" };

// 一度に出す件数
const PAGE_SIZE = 30;

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

// 記録の整理：日常も含めたすべての外出と、Jev の判定（docs/design/DECISIONS.md の 5-4）。
// 地図帳（マイページ）には旅だけを出し、判定の作業はこちらでまとめて行う
export default async function OutingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const [{ data: outings, count }, { count: pendingCount }] = await Promise.all(
    [
      supabase
        .from("outings")
        .select(
          "id, started_at, nights, distance_km, main_transport, source, label, label_source, label_confidence, visited_regions(region_code)",
          { count: "exact" },
        )
        .order("started_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("outings")
        .select("id", { count: "exact", head: true })
        .is("label", null)
        .eq("source", "timeline"),
    ],
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-semibold">記録の整理</h1>
        <p className="text-sm text-muted-foreground">
          取り込んだ外出を Jev
          が「旅行・帰省・日帰り・おでかけ・日常」に分けます。学校など、いつもの場所だけの日は
          Jev を使わず日常にします。Jev
          が使えないとき（キーや残高が無いとき）は、アプリのルールで判定します。間違っていたら選び直してください（選び直したものは
          Jev が上書きしません）。友達に見えるのは、日常以外の外出だけです。
        </p>
      </header>

      <section className="flex flex-col gap-3 border-t-2 border-ink pt-4">
        <h2 className="font-serif text-lg font-semibold">Jev の判定</h2>
        <ClassifyButton pending={pendingCount ?? 0} />
        <Link
          href="/outings/review"
          className="w-fit text-sm underline underline-offset-4 hover:text-vermilion"
        >
          Jev の判定を確かめる（正解率を見る）
        </Link>
      </section>

      <section className="flex flex-col gap-1 border-t-2 border-ink pt-4">
        <h2 className="flex items-baseline justify-between font-serif text-lg font-semibold">
          すべての外出
          <span className="font-sans text-xs font-normal text-muted-foreground tabular-nums">
            新しい順に {Math.min(PAGE_SIZE, count ?? 0)} 件 / 全 {count ?? 0} 件
          </span>
        </h2>
        {outings && outings.length > 0 ? (
          <ul className="text-sm">
            {outings.map((o) => {
              const regionCodes = [
                ...new Set(o.visited_regions.map((r) => r.region_code)),
              ];
              return (
                <li
                  key={o.id}
                  className="flex flex-col gap-1 border-b border-rule py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-serif font-semibold">
                      {dateFormat.format(new Date(o.started_at))}
                      {o.nights > 0 && ` から ${o.nights} 泊`}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {o.distance_km} km
                      {o.main_transport &&
                        `・${TRANSPORT_LABELS[o.main_transport] ?? o.main_transport}`}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {regionCodes.map(regionName).join(" → ") || "―"}
                  </span>
                  {o.source === "timeline" ? (
                    <LabelSelect
                      outingId={o.id}
                      label={o.label}
                      source={o.label_source}
                      confidence={o.label_confidence}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      手入力の旅（{labelName(o.label)}）
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            まだ外出がありません。
            <Link href="/import" className="underline underline-offset-4">
              タイムラインを取り込んで
            </Link>
            ください。
          </p>
        )}
      </section>
    </main>
  );
}
