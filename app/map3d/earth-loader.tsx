"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// 地図のライブラリ（MapLibre）は大きく、ブラウザでしか動かないので、
// サーバーでは描かず（ssr: false）、このページを開いたときだけ読み込む
const EarthMap = dynamic(() => import("./earth-map"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center gap-2 bg-[#050b18] text-sm text-white/80">
      <Loader2 className="size-4 animate-spin" />
      地球儀を準備しています…
    </div>
  ),
});

export { EarthMap };
