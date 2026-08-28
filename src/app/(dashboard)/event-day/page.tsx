"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EventDayState, Issue, OpsStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Radio, AlertTriangle } from "lucide-react";

const DEFAULT_STATE: EventDayState = {
  isLive: false,
  currentSession: "",
  nextSession: "",
  stageStatus: "READY",
  avStatus: "READY",
  photographyStatus: "READY",
  hospitalityStatus: "READY",
  operationsStatus: "READY",
  technicalStatus: "READY",
  registrationCount: 0,
  registrationTarget: 150,
  updatedAt: Date.now(),
};

const STATUS_OPTIONS: OpsStatus[] = ["READY", "ACTIVE", "ISSUE", "OFFLINE"];

const STATUS_COLORS: Record<OpsStatus, string> = {
  READY: "bg-emerald-100 text-emerald-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  ISSUE: "bg-red-100 text-red-700",
  OFFLINE: "bg-neutral-200 text-neutral-600",
};

const STATUS_FIELDS: { key: keyof EventDayState; label: string }[] = [
  { key: "stageStatus", label: "Stage" },
  { key: "avStatus", label: "AV" },
  { key: "photographyStatus", label: "Photography" },
  { key: "hospitalityStatus", label: "Hospitality" },
  { key: "operationsStatus", label: "Operations" },
  { key: "technicalStatus", label: "Technical" },
];

export default function EventDayPage() {
  const { profile } = useAuth();
  const [state, setState] = useState<EventDayState>(DEFAULT_STATE);
  const [criticalIssues, setCriticalIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const canControl = profile?.role === "admin" || profile?.role === "core";

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "eventDay"), (snap) => {
      if (snap.exists()) setState(snap.data() as EventDayState);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(
          collection(db, "issues"),
          where("priority", "==", "CRITICAL"),
          where("status", "in", ["REPORTED", "ASSIGNED", "IN_PROGRESS"])
        )
      );
      setCriticalIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Issue)));
    })();
  }, [state]);

  async function update(partial: Partial<EventDayState>) {
    const next = { ...state, ...partial, updatedAt: Date.now() };
    setState(next);
    await setDoc(doc(db, "settings", "eventDay"), next);
  }

  async function toggleLive() {
    if (!profile) return;
    const next = !state.isLive;
    await update({ isLive: next });
    await logActivity({
      actorId: profile.uid,
      actorName: profile.name,
      action: next ? "EVENT_DAY_STARTED" : "EVENT_DAY_ENDED",
      targetType: "eventDay",
      targetId: "eventDay",
      message: `${profile.name} ${next ? "started" : "ended"} Event Day mode`,
    });
    toast.success(next ? "Event Day mode is now LIVE" : "Event Day mode ended");
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className={`h-6 w-6 ${state.isLive ? "text-red-600 animate-pulse" : "text-neutral-400"}`} />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Event Day Control Room</h1>
            <p className="text-sm text-neutral-500">{state.isLive ? "LIVE EVENT" : "Not live"}</p>
          </div>
        </div>
        {canControl && (
          <Button variant={state.isLive ? "danger" : "primary"} onClick={toggleLive}>
            {state.isLive ? "End Event Day" : "Go Live"}
          </Button>
        )}
      </div>

      {criticalIssues.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4" /> Critical Issues
            </p>
            {criticalIssues.map((issue) => (
              <p key={issue.id} className="text-sm text-red-700">{issue.title} — {issue.location}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Current Session</CardTitle></CardHeader>
          <CardContent>
            {canControl ? (
              <Input value={state.currentSession} onChange={(e) => update({ currentSession: e.target.value })} placeholder="e.g. Speaker 04" />
            ) : (
              <p className="text-lg font-semibold text-neutral-900">{state.currentSession || "—"}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Next Session</CardTitle></CardHeader>
          <CardContent>
            {canControl ? (
              <Input value={state.nextSession} onChange={(e) => update({ nextSession: e.target.value })} placeholder="e.g. Speaker 05" />
            ) : (
              <p className="text-lg font-semibold text-neutral-900">{state.nextSession || "—"}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
          <CardContent>
            {canControl ? (
              <div className="flex items-center gap-2">
                <Input type="number" value={state.registrationCount} onChange={(e) => update({ registrationCount: Number(e.target.value) })} />
                <span className="text-neutral-400">/</span>
                <Input type="number" value={state.registrationTarget} onChange={(e) => update({ registrationTarget: Number(e.target.value) })} />
              </div>
            ) : (
              <p className="text-lg font-semibold text-neutral-900">{state.registrationCount}/{state.registrationTarget}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATUS_FIELDS.map(({ key, label }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between py-4">
              <p className="text-sm font-medium text-neutral-700">{label}</p>
              {canControl ? (
                <Select className="w-32" value={state[key] as OpsStatus} onChange={(e) => update({ [key]: e.target.value as OpsStatus })}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              ) : (
                <Badge className={STATUS_COLORS[state[key] as OpsStatus]}>{state[key] as string}</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
