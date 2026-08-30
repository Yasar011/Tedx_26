"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Role } from "@/lib/types";
import { isActivePath, navItemsFor } from "./navigation";

export function Sidebar({
  role,
  isCoHead,
  hasDepartment,
}: {
  role: Role;
  isCoHead?: boolean;
  hasDepartment?: boolean;
}) {
  const pathname = usePathname();
  const items = navItemsFor(role, { isCoHead, hasDepartment });

  return (
    <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-neutral-200 px-4">
        <Link href="/dashboard" className="flex items-center">
          <Logo priority className="h-8 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#EB0028]/10 text-[#EB0028]"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
