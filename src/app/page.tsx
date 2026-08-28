"use client";

import { useAuth } from "@/contexts/AuthContext";
import { ROLE_HOME_ROUTE } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function Home() {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      router.replace(ROLE_HOME_ROUTE[profile.role]);
    }
  }, [loading, firebaseUser, profile, router]);

  if (loading) return <FullPageSpinner />;
  if (firebaseUser) return <FullPageSpinner />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-6 text-center text-white">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#EB0028] text-xl font-bold">
        TX
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        TEDxNIFT Jodhpur — Organizing Platform
      </h1>
      <p className="mt-3 max-w-md text-sm text-neutral-400">
        The internal system for recruitment, departments, tasks, approvals, and event
        operations.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/apply"
          className="rounded-lg bg-[#EB0028] px-5 py-2.5 text-sm font-medium hover:bg-[#c8001f]"
        >
          Apply to Volunteer
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-medium hover:bg-neutral-900"
        >
          Team Sign In
        </Link>
      </div>
    </div>
  );
}
