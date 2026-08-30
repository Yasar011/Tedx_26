"use client";

import { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function VerifyEmailScreen({
  email,
  context,
}: {
  email: string;
  /** "apply" explains that the form itself is gated on verification. */
  context?: "apply" | "dashboard";
}) {
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  async function resend() {
    if (!auth.currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verification email sent");
    } catch {
      toast.error("Could not send email — try again in a minute");
    } finally {
      setSending(false);
    }
  }

  async function checkNow() {
    if (!auth.currentUser) return;
    setChecking(true);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        window.location.reload();
      } else {
        toast.error("Not verified yet — check your inbox and spam folder");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-10">
          <Logo priority className="mx-auto mb-5 h-9 w-auto" />
          <MailCheck className="mx-auto mb-4 h-10 w-10 text-[#EB0028]" />
          <h1 className="text-lg font-semibold text-neutral-900">Verify your email</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {context === "apply"
              ? "The application form opens once your email is confirmed. We sent a link to"
              : "We sent a verification link to"}{" "}
            <span className="font-medium text-neutral-700">{email}</span>.
          </p>

          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Can&apos;t find it? <span className="font-semibold">Check your spam or junk
            folder</span> — verification mail often lands there. Mark it as “not spam” so you
            get later updates about your application.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={checkNow} loading={checking}>
              I&apos;ve verified — continue
            </Button>
            <Button variant="outline" onClick={resend} loading={sending}>
              Resend verification email
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await signOut(auth);
                router.replace("/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
