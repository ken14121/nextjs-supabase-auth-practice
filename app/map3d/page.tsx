import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getVisitedFeatures } from "@/lib/geo/visited-geojson";
import { createClient } from "@/lib/supabase/server";
import { EarthMap } from "./earth-loader";

export const metadata = { title: "3D 地球儀" };

// 行った県・国を塗った 3D の地球儀（疑似 Google Earth）
export default async function Map3dPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: regions } = await supabase.rpc("get_my_regions");
  const visited = getVisitedFeatures(regions ?? []);

  return (
    <main className="relative flex h-dvh flex-col">
      <EarthMap
        prefectures={visited.prefectures}
        countries={visited.countries}
      />
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="absolute bottom-8 left-3 shadow"
      >
        <Link href="/dashboard">
          <ArrowLeft />
          マイページ
        </Link>
      </Button>
    </main>
  );
}
