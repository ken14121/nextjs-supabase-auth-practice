import { ArrowLeft, Scale } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompareMap } from "@/components/compare-map";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  COMPARE_GROUPS,
  compareRegions,
  summarizeVisits,
  toCountries,
} from "@/lib/friends/compare";
import { userIdSchema } from "@/lib/friends/schema";
import { isPrefectureCode, PREFECTURES, regionName } from "@/lib/geo/names";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "友達と比べる" };

function percent(count: number) {
  return Math.round((count / PREFECTURES.length) * 100);
}

// 友達と「行った県・国」を比べるページ
export default async function CompareWithFriendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = userIdSchema.safeParse(id);
  if (!parsedId.success) notFound();
  const friendId = parsedId.data;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/");

  // 承認済みの友達でなければ、このページは無いものとして扱う
  const { data: friendship } = await supabase
    .from("friendships")
    .select("status")
    .or(
      `and(requester_id.eq.${userId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${userId})`,
    )
    .eq("status", "accepted")
    .maybeSingle();
  if (!friendship) notFound();

  const [{ data: profile }, { data: mine }, { data: theirRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", friendId)
        .single(),
      supabase.rpc("get_my_regions"),
      // 友達のデータは、関数の中で「友達かどうか」を確かめてから県・国と日付だけが返る
      supabase.rpc("get_friend_visited_regions", { friend_id: friendId }),
    ]);

  const friendName = profile?.display_name || "名前未設定";
  const myCodes = (mine ?? []).map((r) => r.region_code);
  const theirCodes = summarizeVisits(theirRows ?? []).map((r) => r.region_code);

  const prefectures = compareRegions(
    myCodes.filter(isPrefectureCode),
    theirCodes.filter(isPrefectureCode),
  );
  const countries = compareRegions(
    toCountries(myCodes),
    toCountries(theirCodes),
  );

  const myPrefectures = prefectures.mine.length + prefectures.both.length;
  const theirPrefectures = prefectures.theirs.length + prefectures.both.length;
  const myCountries = countries.mine.length + countries.both.length;
  const theirCountries = countries.theirs.length + countries.both.length;

  const groupLabel = (key: (typeof COMPARE_GROUPS)[number]["key"]) =>
    key === "theirs"
      ? `${friendName}さんだけ`
      : COMPARE_GROUPS.find((g) => g.key === key)?.label;

  return (
    <main className="flex flex-1 justify-center bg-muted p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Scale className="size-6" />
              {friendName}さんと比べる
            </CardTitle>
            <CardDescription>
              {friendName}
              さんの記録は、旅行・帰省・日帰りの外出だけです（日常の外出と、まだ判定していない外出は共有されません）。あなたの側は、マイページの地図と同じすべての記録です。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium" />
                    <th className="py-2 font-medium">あなた</th>
                    <th className="py-2 font-medium">{friendName}さん</th>
                    <th className="py-2 font-medium">どちらも</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">都道府県</th>
                    <td className="py-2">
                      <span className="text-lg font-semibold">
                        {myPrefectures}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        / 47（{percent(myPrefectures)}%）
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="text-lg font-semibold">
                        {theirPrefectures}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        / 47（{percent(theirPrefectures)}%）
                      </span>
                    </td>
                    <td className="py-2 text-lg font-semibold">
                      {prefectures.both.length}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2 text-left font-medium">国・地域</th>
                    <td className="py-2 text-lg font-semibold">
                      {myCountries}
                    </td>
                    <td className="py-2 text-lg font-semibold">
                      {theirCountries}
                    </td>
                    <td className="py-2 text-lg font-semibold">
                      {countries.both.length}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <CompareMap
              prefectures={prefectures}
              countries={countries}
              friendName={friendName}
            />
            <p className="text-xs text-muted-foreground">
              県や国にカーソルを合わせると、どちらが行ったかが出ます。境界データ:
              地球地図日本（国土地理院）、Natural Earth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>一覧</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {COMPARE_GROUPS.map((group) => {
              const codes = [
                ...prefectures[group.key],
                ...countries[group.key].filter((c) => c !== "JP"),
              ];
              return (
                <div key={group.key} className="flex flex-col gap-1">
                  <h3 className="flex items-center gap-2 font-medium">
                    <span
                      className="size-3 rounded-sm"
                      style={{ backgroundColor: group.fill }}
                    />
                    {groupLabel(group.key)}
                    <span className="font-normal text-muted-foreground">
                      {codes.length}
                    </span>
                  </h3>
                  <p className="[word-break:auto-phrase]">
                    {codes.length > 0
                      ? codes.map(regionName).join("・")
                      : "なし"}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Link
          href="/friends"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          友達一覧に戻る
        </Link>
      </div>
    </main>
  );
}
