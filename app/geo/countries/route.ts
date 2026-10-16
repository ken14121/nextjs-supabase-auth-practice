import { getGlobeCountries } from "@/lib/geo/map-shapes";

// 地図帳の地球儀（components/world-globe.tsx）で回す、世界の国の形。
// 誰が見ても同じ公開データなので、ビルドのときに 1 回だけ作って静的なファイルとして配る
export const dynamic = "force-static";

export function GET() {
  return Response.json(getGlobeCountries());
}
