import { getNationalMunicipalityShapes } from "@/lib/geo/municipality-shapes";

// 市区町村踏破の全国地図の形（SVG の path）。誰が見ても同じ公開データなので、
// ビルドのときに 1 回だけ作って静的なファイルとして配る
export const dynamic = "force-static";

export function GET() {
  return Response.json(getNationalMunicipalityShapes());
}
