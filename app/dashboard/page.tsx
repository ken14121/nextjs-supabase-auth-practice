import {
  BookOpen,
  Earth,
  FileUp,
  LogOut,
  Luggage,
  MapPinned,
  Route,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VisitedMap } from "@/components/visited-map";
import { isPrefectureCode, PREFECTURES, regionName } from "@/lib/geo/names";
import { createClient } from "@/lib/supabase/server";

const TRANSPORT_LABELS: Record<string, string> = {
  walk: "徒歩",
  bicycle: "自転車",
  car: "車",
  bus: "バス",
  train: "電車",
  flight: "飛行機",
  boat: "船",
  other: "その他",
};

const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

// ログインしている人だけが見られるページ
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // proxy.ts でも弾いているが、ページ側でも必ず確認する
  if (!claims) {
    redirect("/");
  }

  // どれも RLS があるので、自分の行しか返ってこない
  const [{ data: profile }, { data: regions }, { data: outings, count }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, friend_code")
        .eq("id", claims.sub)
        .single(),
      supabase.rpc("get_my_regions"),
      supabase
        .from("outings")
        .select(
          "id, started_at, ended_at, nights, distance_km, main_transport, visited_regions(region_code)",
          { count: "exact" },
        )
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

  const name =
    profile?.display_name || claims.user_metadata?.full_name || "名前未設定";
  const codes = (regions ?? []).map((r) => r.region_code);
  const prefectureCount = codes.filter(isPrefectureCode).length;
  const countryCount = new Set(
    codes.map((c) => (isPrefectureCode(c) ? "JP" : c)),
  ).size;

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserRound className="size-6" />
              マイページ
            </CardTitle>
            <CardDescription>
              Google アカウントでログインしています。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">名前</dt>
              <dd>{name}</dd>
              <dt className="text-muted-foreground">メール</dt>
              <dd>{claims.email}</dd>
              <dt className="text-muted-foreground">フレンドコード</dt>
              <dd className="font-mono tracking-wider">
                {profile?.friend_code ?? "読み込めませんでした"}
              </dd>
            </dl>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button asChild className="flex-1">
              <Link href="/import">
                <FileUp />
                タイムラインを取り込む
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/trips">
                <Luggage />
                旅を手で追加
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/guide">
                <BookOpen />
                書き出し方
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                <LogOut />
                ログアウト
              </Button>
            </form>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPinned className="size-5" />
              行った場所
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-xs text-muted-foreground">都道府県</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {prefectureCount}
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    / {PREFECTURES.length}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">国・地域</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {countryCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">外出</dt>
                <dd className="text-2xl font-semibold tabular-nums">
                  {count ?? 0}
                </dd>
              </div>
            </dl>
            <VisitedMap regions={regions ?? []} />
            <Button asChild variant="outline" className="w-fit">
              <Link href="/map3d">
                <Earth />
                3D の地球儀で見る
              </Link>
            </Button>
            {codes.length > 0 && (
              <p className="text-sm [word-break:auto-phrase]">
                {codes.map(regionName).join("・")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              境界データ: 地球地図日本（国土地理院）、Natural Earth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="size-5" />
              最近の外出
            </CardTitle>
            <CardDescription>
              新しい順に 20 件。旅行かどうかの判定は Step 7 で Jev が行います。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outings && outings.length > 0 ? (
              <ul className="divide-y text-sm">
                {outings.map((o) => {
                  const regionCodes = [
                    ...new Set(o.visited_regions.map((r) => r.region_code)),
                  ];
                  return (
                    <li key={o.id} className="flex flex-col gap-1 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">
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
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだ外出がありません。タイムラインを取り込んでみましょう。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
