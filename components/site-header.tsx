import Link from "next/link";
import { APP_NAME } from "@/lib/app-name";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "./site-nav";

// すべてのページの上に出る細い帯（docs/design/DECISIONS.md の 4-5）。
// ログインしているときだけ、ページの入口を並べる
export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  return (
    <header className="sticky top-0 z-40 h-(--header-h) border-b border-ink bg-paper/95 backdrop-blur [--header-h:2.75rem]">
      <div className="mx-auto flex h-full max-w-3xl items-center gap-6 px-4 sm:px-6">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="shrink-0 font-serif text-[1.05rem] font-semibold tracking-wide"
        >
          {APP_NAME}
        </Link>
        {isLoggedIn && <SiteNav />}
      </div>
    </header>
  );
}
