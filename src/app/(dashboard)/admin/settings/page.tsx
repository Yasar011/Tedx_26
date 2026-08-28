"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EventSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

const DEFAULTS: EventSettings = {
  eventName: "TEDxNIFT Jodhpur",
  year: new Date().getFullYear(),
  theme: "",
  eventDate: "",
  memberIdFormat: "TEDX{YY}-{DEPT}-{NNNN}",
  applicationsOpen: true,
  updatedAt: Date.now(),
};

export default function AdminSettingsPage() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<EventSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "settings", "event"));
      if (snap.exists()) setSettings(snap.data() as EventSettings);
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "event"), { ...settings, updatedAt: Date.now() });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "SETTINGS_UPDATED",
        targetType: "settings",
        targetId: "event",
        message: `${profile.name} updated event settings`,
      });
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Event Settings</h1>
        <p className="text-sm text-neutral-500">
          Configure event-wide values so nothing is hard-coded across the platform.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Event Name">
            <Input value={settings.eventName} onChange={(e) => setSettings((s) => ({ ...s, eventName: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year">
              <Input
                type="number"
                value={settings.year}
                onChange={(e) => setSettings((s) => ({ ...s, year: Number(e.target.value) }))}
              />
            </FormField>
            <FormField label="Event Date">
              <Input
                type="date"
                value={settings.eventDate}
                onChange={(e) => setSettings((s) => ({ ...s, eventDate: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Theme">
            <Input value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recruitment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="TEDx Member ID Format" hint="Reference only — {YY}, {DEPT}, {NNNN} placeholders">
            <Input
              value={settings.memberIdFormat}
              onChange={(e) => setSettings((s) => ({ ...s, memberIdFormat: e.target.value }))}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.applicationsOpen}
              onChange={(e) => setSettings((s) => ({ ...s, applicationsOpen: e.target.checked }))}
            />
            Applications are open at /apply
          </label>
        </CardContent>
      </Card>

      <Button onClick={save} loading={saving}>Save Settings</Button>
    </div>
  );
}
