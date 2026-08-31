"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, EventSettings } from "@/lib/types";
import { ROLE_HOME_ROUTE } from "@/lib/constants";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { ConnectionErrorScreen } from "@/components/auth/ConnectionErrorScreen";
import { LogoPlate } from "@/components/ui/Logo";
import { Reveal } from "@/components/ui/Reveal";
import { IntroLoader } from "@/components/ui/IntroLoader";
import { ArrowRight, Sparkles, Users, CalendarDays } from "lucide-react";

export default function Home() {
  const { firebaseUser, profile, profileError, loading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (!loading && firebaseUser && profile) {
      router.replace(ROLE_HOME_ROUTE[profile.role]);
    }
  }, [loading, firebaseUser, profile, router]);

  // Public content — both settings and departments are world-readable, so
  // this renders for signed-out visitors. Failures are non-fatal: the page
  // simply falls back to its static copy.
  useEffect(() => {
    (async () => {
      try {
        const [settingsSnap, deptSnap] = await Promise.all([
          getDoc(doc(db, "settings", "event")),
          getDocs(query(collection(db, "departments"), where("active", "==", true))),
        ]);
        if (settingsSnap.exists()) setSettings(settingsSnap.data() as EventSettings);
        setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
      } catch {
        /* keep the static fallback */
      }
    })();
  }, []);

  if (loading) return <FullPageSpinner />;
  if (firebaseUser && profileError) return <ConnectionErrorScreen message={profileError} />;
  if (firebaseUser) return <FullPageSpinner />;

  const year = settings?.year ?? new Date().getFullYear();
  const eventDate = settings?.eventDate
    ? new Date(settings.eventDate).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const openDepartments = departments.filter((d) => d.applicationsOpen !== false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-white">
      <IntroLoader />

      {/* Ambient drifting glow behind the hero. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-glow absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#EB0028]/25 blur-[120px]" />
        <div
          className="animate-glow absolute top-1/3 -right-32 h-[26rem] w-[26rem] rounded-full bg-[#EB0028]/15 blur-[110px]"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      {/* ---------------- HERO ---------------- */}
      <header className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-20 text-center sm:pt-32">
        <div className="animate-fade-up">
          <LogoPlate />
        </div>

        <p
          className="animate-fade-up mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-[#EB0028]"
          style={{ animationDelay: "120ms" }}
        >
          x = independently organized event
        </p>

        <h1
          className="animate-fade-up mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl"
          style={{ animationDelay: "200ms" }}
        >
          {settings?.theme ? (
            <>
              <span className="block text-neutral-400 text-2xl sm:text-3xl font-normal mb-3">
                {year} Theme
              </span>
              {settings.theme}
            </>
          ) : (
            <>
              Ideas worth
              <span className="block text-[#EB0028]">spreading.</span>
            </>
          )}
        </h1>

        <p
          className="animate-fade-up mt-6 max-w-xl text-base leading-relaxed text-neutral-400"
          style={{ animationDelay: "300ms" }}
        >
          {settings?.eventName ?? "TEDxNIFT Jodhpur"} brings together speakers, students and
          makers for a day of talks that spark conversation — organised entirely by students.
        </p>

        {eventDate && (
          <p
            className="animate-fade-up mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-neutral-300"
            style={{ animationDelay: "360ms" }}
          >
            <CalendarDays className="h-4 w-4 text-[#EB0028]" />
            {eventDate}
          </p>
        )}

        <div
          className="animate-fade-up mt-10 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "420ms" }}
        >
          <Link
            href="/apply"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#EB0028] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#c8001f] hover:shadow-[0_0_40px_-8px_rgba(235,0,40,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB0028] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Join the team
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Team sign in
          </Link>
        </div>
      </header>

      {/* ---------------- MARQUEE ---------------- */}
      <div
        aria-hidden
        className="relative flex overflow-hidden border-y border-white/10 bg-white/[0.03] py-4"
      >
        <div className="animate-marquee flex shrink-0 items-center gap-10 whitespace-nowrap pr-10">
          {Array.from({ length: 2 }).map((_, block) => (
            <div key={block} className="flex shrink-0 items-center gap-10">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="flex items-center gap-10 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500"
                >
                  Ideas worth spreading
                  <span className="text-[#EB0028]">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- WHAT IS TEDx ---------------- */}
      <section className="relative mx-auto max-w-5xl px-6 py-24">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            What is TEDx?
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-5 max-w-2xl text-center leading-relaxed text-neutral-400">
            TED is a nonprofit devoted to ideas worth spreading. TEDx events are independently
            organised by volunteers under a free licence from TED — same spirit, local voices.
            Ours is run end to end by NIFT Jodhpur students.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Real talks",
              body: "Speakers from design, business, technology and the arts, chosen and coached by our content team.",
            },
            {
              icon: Users,
              title: "Student run",
              body: "Every department — from sponsorship to stage — is led by students who own their piece of the event.",
            },
            {
              icon: CalendarDays,
              title: "One day, one room",
              body: "A single stage, a full day of ideas, and the conversations that keep going long after.",
            },
          ].map((card, i) => (
            <Reveal key={card.title} delay={i * 120}>
              <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-[#EB0028]/40 hover:bg-white/[0.06]">
                <card.icon className="h-6 w-6 text-[#EB0028]" />
                <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{card.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------- DEPARTMENTS ---------------- */}
      {openDepartments.length > 0 && (
        <section className="relative mx-auto max-w-5xl px-6 pb-24">
          <Reveal>
            <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
              Find your team
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-4 max-w-xl text-center text-neutral-400">
              {openDepartments.length} department{openDepartments.length !== 1 && "s"} are
              currently accepting volunteers.
            </p>
          </Reveal>

          {/* Head and Co-Head are denormalised onto the department document,
              so they're readable here without exposing the users collection
              publicly. */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {openDepartments.map((d, i) => (
              <Reveal key={d.id} delay={Math.min(i * 70, 420)}>
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-[#EB0028]/40 hover:bg-white/[0.06]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-snug text-white">{d.name}</h3>
                    <span className="shrink-0 rounded-full bg-[#EB0028]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#EB0028]">
                      {d.code}
                    </span>
                  </div>

                  {d.description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-400">
                      {d.description}
                    </p>
                  )}

                  <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs">
                    <p className="text-neutral-400">
                      <span className="text-neutral-500">Head: </span>
                      {d.headName ? (
                        <span className="text-neutral-200">{d.headName}</span>
                      ) : (
                        <span className="text-neutral-600">to be announced</span>
                      )}
                    </p>
                    {d.coHeadName && (
                      <p className="text-neutral-400">
                        <span className="text-neutral-500">Co-Head: </span>
                        <span className="text-neutral-200">{d.coHeadName}</span>
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- CLOSING CTA ---------------- */}
      <section className="relative mx-auto max-w-3xl px-6 pb-28 text-center">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-10 sm:p-14">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Want to help build it?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-neutral-400">
              Applications are open to NIFT Jodhpur students. Pick a department, tell us what
              you&apos;re good at, and we&apos;ll take it from there.
            </p>
            <Link
              href="/apply"
              className="group mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#EB0028] px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#c8001f] hover:shadow-[0_0_40px_-8px_rgba(235,0,40,0.7)]"
            >
              Apply to volunteer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="relative border-t border-white/10 px-6 py-10 text-center text-xs text-neutral-500">
        <p>
          This independent TEDx event is operated under licence from TED.
        </p>
        <p className="mt-2">
          {settings?.eventName ?? "TEDxNIFT Jodhpur"} · {year}
        </p>
      </footer>
    </div>
  );
}
