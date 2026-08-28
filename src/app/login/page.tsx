"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { toast } from "sonner";
import { isNiftEmail, NIFT_EMAIL_DOMAIN } from "@/lib/validation";
import { logActivity } from "@/lib/activity";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await logActivity({
          actorId: cred.user.uid,
          actorName: cred.user.displayName || email,
          action: "USER_LOGGED_IN",
          targetType: "user",
          targetId: cred.user.uid,
          message: `${cred.user.displayName || email} logged in`,
        }).catch(() => {});
      } else {
        if (!isNiftEmail(email)) {
          toast.error(`Only ${NIFT_EMAIL_DOMAIN} email addresses can create an account`);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          email,
          name,
          role: "unassigned",
          departmentId: null,
          tedxId: null,
          status: "active",
          createdAt: Date.now(),
        });
        await sendEmailVerification(cred.user);
      }
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message.replace("Firebase: ", ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#EB0028] text-sm font-bold text-white">
              TX
            </div>
            <h1 className="text-lg font-semibold text-neutral-900">Organizing Team Sign In</h1>
            <p className="mt-1 text-sm text-neutral-500">TEDxNIFT Jodhpur</p>
          </div>

          <div className="mb-5 flex rounded-lg bg-neutral-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md py-1.5 ${mode === "signin" ? "bg-white shadow-sm" : "text-neutral-500"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-1.5 ${mode === "signup" ? "bg-white shadow-sm" : "text-neutral-500"}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <FormField label="Full name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </FormField>
            )}
            <FormField label="Email" required hint={mode === "signup" ? `Must end in ${NIFT_EMAIL_DOMAIN}` : undefined}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </FormField>
            <Button type="submit" className="w-full" loading={loading}>
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          {mode === "signup" && (
            <p className="mt-4 text-center text-xs text-neutral-500">
              New accounts start unassigned until an Admin grants a role.
            </p>
          )}

          <p className="mt-6 text-center text-xs text-neutral-400">
            Applying to volunteer instead?{" "}
            <Link href="/apply" className="text-[#EB0028] hover:underline">
              Go to the application form
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
