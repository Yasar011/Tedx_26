"use client";

import { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function VerifyEmailScreen({ email }: { email: string }) {
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
        router.refresh();
        window.location.reload();
      } else {
        toast.error("Not verified yet — check your inbox");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-10">
          <MailCheck className="mx-auto mb-4 h-10 w-10 text-[#EB0028]" />
          <h1 className="text-lg font-semibold text-neutral-900">Verify your email</h1>
          <p className="mt-2 text-sm text-neutral-500">
            We sent a verification link to <span className="font-medium text-neutral-700">{email}</span>.
            Please verify your email before continuing.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={checkNow} loading={checking}>I&apos;ve verified — continue</Button>
            <Button variant="outline" onClick={resend} loading={sending}>Resend verification email</Button>
            <Button variant="ghost" onClick={() => signOut(auth)}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
