"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "地図帳" },
  { href: "/trips", label: "旅の索引" },
  { href: "/friends", label: "友達" },
  { href: "/map3d", label: "地球儀" },
  { href: "/outings", label: "記録の整理" },
  { href: "/import", label: "取り込む" },
];

// 帯の中のページの入口。いま開いているページには朱の下線を引く。
// スマホでは横にスクロールできる
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="ページ"
      className="-mx-1 flex min-w-0 flex-1 gap-4 overflow-x-auto px-1 text-sm whitespace-nowrap [scrollbar-width:none]"
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 py-1 transition-colors",
              active
                ? "border-vermilion text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
