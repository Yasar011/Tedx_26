"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function Topbar() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  if (!profile) return null;

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 md:px-6">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{ROLE_LABELS[profile.role]}</p>
        {profile.tedxId && <p className="text-xs text-neutral-500">{profile.tedxId}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
          {initials(profile.name || profile.email)}
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-neutral-900">{profile.name}</p>
          <p className="text-xs text-neutral-500">{profile.email}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
