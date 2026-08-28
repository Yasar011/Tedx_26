"use client";

"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/Card";
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
        </CardContent>
      </Card>
    </div>
  );
}
