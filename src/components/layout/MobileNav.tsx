"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Role } from "@/lib/types";
import { isActivePath, navItemsFor } from "./navigation";

/**
 * Navigation for phones, where the sidebar is hidden.
 *
 * Without this a signed-in user on a phone can reach their landing page and
 * nothing else — and volunteers are expected to be on phones for most of
 * the event prep.
 */
export function MobileNav({
  role,
  isCoHead,
  hasDepartment,
}: {
  role: Role;
  isCoHead?: boolean;
  hasDepartment?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = navItemsFor(role, { isCoHead, hasDepartment });

  // Close on navigation, so tapping a link doesn't leave the drawer over
  // the page it just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Don't let the page behind scroll while the drawer is over it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/40"
          />
          <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
              <Logo className="h-8 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-[#EB0028]/10 text-[#EB0028]"
                        : "text-neutral-700 hover:bg-neutral-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
