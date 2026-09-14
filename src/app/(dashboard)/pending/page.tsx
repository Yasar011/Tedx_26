"use client";

"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Clock } from "lucide-react";

export default function PendingPage() {
  const { profile } = useAuth();
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <Clock className="mb-4 h-10 w-10 text-neutral-400" />
          <h1 className="text-lg font-semibold text-neutral-900">Awaiting role assignment</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Your account, {profile.email}, has been created but has not yet been assigned a
            role or department. An Admin needs to activate your access from the Team
            Management page.
          </p>

          {/* Most people who land here are volunteers who signed up meaning to
              apply, and were left waiting on an Admin for something they can
              do themselves. */}
          <div className="mt-6 w-full border-t border-neutral-100 pt-6">
            <p className="text-sm text-neutral-600">
              Meant to join as a volunteer? You don&apos;t need to wait — fill in the
              application form and the team will pick it up from there.
            </p>
            <Link href="/apply">
              <Button className="mt-4">Apply to join a team</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
