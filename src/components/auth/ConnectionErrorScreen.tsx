"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CloudOff } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

export function ConnectionErrorScreen({ message }: { message: string }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-10">
          <CloudOff className="mx-auto mb-4 h-10 w-10 text-neutral-400" />
          <h1 className="text-lg font-semibold text-neutral-900">Can&apos;t load your account</h1>
          <p className="mt-2 text-sm text-neutral-500">
            You&apos;re signed in, but the app couldn&apos;t load your account data.
          </p>
          <p className="mt-3 rounded-lg bg-neutral-100 p-2 text-left font-mono text-xs text-neutral-500">
            {message}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button
              variant="outline"
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
