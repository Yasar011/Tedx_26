"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DirectMessage, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { notify } from "@/lib/notifications";
import { toast } from "sonner";
import { Mail, Plus } from "lucide-react";

type Tab = "inbox" | "sent";

export default function MessagesPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("inbox");
  const [inbox, setInbox] = useState<DirectMessage[]>([]);
  const [sent, setSent] = useState<DirectMessage[]>([]);
  const [recipients, setRecipients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "" });

  async function load() {
    if (!profile) return;
    const [inboxSnap, sentSnap] = await Promise.all([
      getDocs(query(collection(db, "messages"), where("recipientId", "==", profile.uid))),
      getDocs(query(collection(db, "messages"), where("senderId", "==", profile.uid))),
    ]);
    setInbox(inboxSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DirectMessage)).sort((a, b) => b.createdAt - a.createdAt));
    setSent(sentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DirectMessage)).sort((a, b) => b.createdAt - a.createdAt));

    let recipientList: UserProfile[] = [];
    if (profile.role === "admin" || profile.role === "core") {
      const allSnap = await getDocs(collection(db, "users"));
      recipientList = allSnap.docs.map((d) => d.data() as UserProfile);
    } else {
      const [deptSnap, leadershipSnap] = await Promise.all([
        profile.departmentId
          ? getDocs(query(collection(db, "users"), where("departmentId", "==", profile.departmentId)))
          : Promise.resolve(null),
        getDocs(query(collection(db, "users"), where("role", "in", ["admin", "core"]))),
      ]);
      const deptUsers = deptSnap ? deptSnap.docs.map((d) => d.data() as UserProfile) : [];
      const leaders = leadershipSnap.docs.map((d) => d.data() as UserProfile);
      const seen = new Set<string>();
      recipientList = [...deptUsers, ...leaders].filter((u) => {
        if (seen.has(u.uid)) return false;
        seen.add(u.uid);
        return true;
      });
    }
    setRecipients(recipientList.filter((u) => u.uid !== profile.uid));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function send() {
    if (!profile) return;
    const recipient = recipients.find((r) => r.uid === form.recipientId);
    if (!recipient) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "messages"), {
        senderId: profile.uid,
        senderName: profile.name,
        recipientId: recipient.uid,
        recipientName: recipient.name,
        subject: form.subject,
        body: form.body,
        read: false,
        createdAt: Date.now(),
      });
      await notify({
        userId: recipient.uid,
        title: `New message from ${profile.name}`,
        message: form.subject,
        type: "MESSAGE",
        relatedId: ref.id,
        link: "/messages",
      });
      toast.success("Message sent");
      setModalOpen(false);
      setForm({ recipientId: "", subject: "", body: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function markRead(message: DirectMessage) {
    if (message.read) return;
    await updateDoc(doc(db, "messages", message.id), { read: true });
    load();
  }

  if (loading) return <FullPageSpinner />;

  const list = tab === "inbox" ? inbox : sent;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Messages</h1>
          <p className="text-sm text-neutral-500">Direct messages with your team.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> New Message
        </Button>
      </div>

      <div className="flex gap-2">
        {(["inbox", "sent"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {t} {t === "inbox" && inbox.filter((m) => !m.read).length > 0 && `(${inbox.filter((m) => !m.read).length})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Mail} title={tab === "inbox" ? "No messages received" : "No messages sent"} />
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <Card
              key={m.id}
              className={tab === "inbox" && !m.read ? "border-[#EB0028]/40 bg-red-50/30" : ""}
              onClick={() => tab === "inbox" && markRead(m)}
            >
              <CardContent className="space-y-1 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-neutral-900">{m.subject}</p>
                  <p className="text-xs text-neutral-400">{formatDateTime(m.createdAt)}</p>
                </div>
                <p className="text-xs text-neutral-500">
                  {tab === "inbox" ? `From ${m.senderName}` : `To ${m.recipientName}`}
                </p>
                <p className="text-sm text-neutral-700">{m.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Message">
        <div className="space-y-4">
          <FormField label="To" required>
            <Select value={form.recipientId} onChange={(e) => setForm((f) => ({ ...f, recipientId: e.target.value }))}>
              <option value="">Select a recipient</option>
              {recipients.map((r) => (
                <option key={r.uid} value={r.uid}>{r.name} ({r.role})</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subject" required>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </FormField>
          <FormField label="Message" required>
            <Textarea rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </FormField>
          <Button className="w-full" onClick={send} loading={saving} disabled={!form.recipientId || !form.subject || !form.body}>
            Send Message
          </Button>
        </div>
      </Modal>
    </div>
  );
}
