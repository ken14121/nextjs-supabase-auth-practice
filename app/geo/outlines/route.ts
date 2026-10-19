import { getOutlineFeatures } from "@/lib/geo/outline-geojson";

// 線の地球儀に引く海岸線・国境・県境（約 0.5MB の GeoJSON）。
// 誰が見ても同じ公開データなので、ビルドのときに 1 回だけ作って静的なファイルとして配る
export const dynamic = "force-static";

export function GET() {
  return Response.json(getOutlineFeatures());
}
