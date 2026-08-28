"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Announcement, AnnouncementPriority } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { notifyMany } from "@/lib/notifications";
import { toast } from "sonner";
import { Megaphone, Plus } from "lucide-react";

const PRIORITY_COLORS: Record<AnnouncementPriority, string> = {
  NORMAL: "bg-neutral-100 text-neutral-700",
  IMPORTANT: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    scope: "department" as "org" | "department",
    priority: "NORMAL" as AnnouncementPriority,
  });

  const canPostOrg = profile?.role === "admin" || profile?.role === "core";
  const canPostDept = profile?.role === "department_head";

  async function load() {
    if (!profile) return;
    const orgSnap = await getDocs(query(collection(db, "announcements"), where("scope", "==", "org")));
    let deptAnns: Announcement[] = [];
    if (profile.departmentId) {
      const deptSnap = await getDocs(
        query(collection(db, "announcements"), where("scope", "==", "department"), where("departmentId", "==", profile.departmentId))
      );
      deptAnns = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
    } else if (profile.role === "admin" || profile.role === "core") {
      const allDeptSnap = await getDocs(query(collection(db, "announcements"), where("scope", "==", "department")));
      deptAnns = allDeptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
    }
    const orgAnns = orgSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
    setAnnouncements([...orgAnns, ...deptAnns].sort((a, b) => b.createdAt - a.createdAt));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function post() {
    if (!profile) return;
    setSaving(true);
    try {
      const scope = canPostOrg ? form.scope : "department";
      const ref = await addDoc(collection(db, "announcements"), {
        title: form.title,
        message: form.message,
        authorId: profile.uid,
        authorName: profile.name,
        scope,
        departmentId: scope === "department" ? profile.departmentId : null,
        priority: form.priority,
        createdAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "ANNOUNCEMENT_POSTED",
        targetType: "announcement",
        targetId: ref.id,
        message: `${profile.name} posted "${form.title}" (${scope})`,
        departmentId: scope === "department" ? profile.departmentId : null,
      });

      let recipientIds: string[] = [];
      if (scope === "org") {
        const usersSnap = await getDocs(collection(db, "users"));
        recipientIds = usersSnap.docs.map((d) => d.id).filter((uid) => uid !== profile.uid);
      } else if (profile.departmentId) {
        const teamSnap = await getDocs(query(collection(db, "users"), where("departmentId", "==", profile.departmentId)));
        recipientIds = teamSnap.docs.map((d) => d.id).filter((uid) => uid !== profile.uid);
      }
      if (recipientIds.length > 0) {
        await notifyMany(recipientIds, {
          title: "New announcement",
          message: form.title,
          type: "ANNOUNCEMENT",
          relatedId: ref.id,
          link: "/announcements",
        });
      }

      toast.success("Announcement posted");
      setModalOpen(false);
      setForm({ title: "", message: "", scope: "department", priority: "NORMAL" });
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Announcements</h1>
          <p className="text-sm text-neutral-500">Organization and department updates</p>
        </div>
        {(canPostOrg || canPostDept) && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-neutral-900">{a.title}</p>
                  <div className="flex gap-2">
                    <Badge className={PRIORITY_COLORS[a.priority]}>{a.priority}</Badge>
                    <Badge className="bg-neutral-100 text-neutral-600">{a.scope === "org" ? "Organization" : "Department"}</Badge>
                  </div>
                </div>
                <p className="text-sm text-neutral-700">{a.message}</p>
                <p className="text-xs text-neutral-400">{a.authorName} · {formatDateTime(a.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Announcement">
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Message" required>
            <Textarea rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            {canPostOrg && (
              <FormField label="Scope">
                <Select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "org" | "department" }))}>
                  <option value="org">Entire Organization</option>
                  <option value="department">My Department</option>
                </Select>
              </FormField>
            )}
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as AnnouncementPriority }))}>
                <option value="NORMAL">Normal</option>
                <option value="IMPORTANT">Important</option>
                <option value="URGENT">Urgent</option>
              </Select>
            </FormField>
          </div>
          <Button className="w-full" onClick={post} loading={saving} disabled={!form.title || !form.message}>
            Post Announcement
          </Button>
        </div>
      </Modal>
    </div>
  );
}
