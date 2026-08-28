"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CloudOff } from "lucide-react";

export function ConnectionErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="py-10">
          <CloudOff className="mx-auto mb-4 h-10 w-10 text-neutral-400" />
          <h1 className="text-lg font-semibold text-neutral-900">Can&apos;t reach the database</h1>
          <p className="mt-2 text-sm text-neutral-500">
            The app couldn&apos;t load your account data. This usually means Cloud Firestore
            hasn&apos;t been enabled yet for this Firebase project, or your connection dropped.
          </p>
          <p className="mt-3 rounded-lg bg-neutral-100 p-2 text-left font-mono text-xs text-neutral-500">{message}</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
