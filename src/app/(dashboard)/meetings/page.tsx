"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ActionItem, Meeting, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { toast } from "sonner";
import { CalendarDays, Plus } from "lucide-react";

export default function MeetingsPage() {
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = profile?.role === "admin" || profile?.role === "core" || profile?.role === "department_head";

  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    attendees: [] as string[],
    agenda: "",
  });

  async function load() {
    const [meetingSnap, userSnap] = await Promise.all([
      getDocs(collection(db, "meetings")),
      getDocs(collection(db, "users")),
    ]);
    setMeetings(meetingSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting)).sort((a, b) => b.createdAt - a.createdAt));
    setUsers(userSnap.docs.map((d) => d.data() as UserProfile));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createMeeting() {
    if (!profile) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "meetings"), {
        title: form.title,
        date: form.date,
        time: form.time,
        location: form.location,
        attendees: form.attendees,
        agenda: form.agenda,
        notes: "",
        decisions: "",
        actionItems: [],
        createdBy: profile.uid,
        createdByName: profile.name,
        createdAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "MEETING_SCHEDULED",
        targetType: "meeting",
        targetId: ref.id,
        message: `${profile.name} scheduled "${form.title}" for ${form.date}`,
      });
      await Promise.all(
        form.attendees.map((uid) =>
          notify({
            userId: uid,
            title: "Meeting scheduled",
            message: `"${form.title}" on ${form.date} at ${form.time}`,
            type: "MEETING_SCHEDULED",
            relatedId: ref.id,
            link: "/meetings",
          })
        )
      );
      toast.success("Meeting scheduled");
      setModalOpen(false);
      setForm({ title: "", date: "", time: "", location: "", attendees: [], agenda: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes(meeting: Meeting, notes: string, decisions: string) {
    await updateDoc(doc(db, "meetings", meeting.id), { notes, decisions });
    toast.success("Meeting notes saved");
    load();
  }

  async function addActionItem(meeting: Meeting, text: string, assignedTo: string) {
    const assignee = users.find((u) => u.uid === assignedTo);
    const item: ActionItem = {
      id: crypto.randomUUID(),
      text,
      assignedTo: assignedTo || null,
      assignedToName: assignee?.name ?? null,
      taskId: null,
    };
    await updateDoc(doc(db, "meetings", meeting.id), { actionItems: [...meeting.actionItems, item] });
    load();
  }

  async function convertToTask(meeting: Meeting, item: ActionItem) {
    if (!profile) return;
    if (!item.assignedTo) {
      toast.error("Assign this action item to someone before converting it to a task");
      return;
    }
    const userSnap = await getDoc(doc(db, "users", item.assignedTo));
    const assigneeProfile = userSnap.exists() ? (userSnap.data() as UserProfile) : null;
    if (!assigneeProfile?.departmentId) {
      toast.error(`${item.assignedToName} isn't assigned to a department yet`);
      return;
    }
    const deptSnap = await getDoc(doc(db, "departments", assigneeProfile.departmentId));
    const deptName = deptSnap.exists() ? deptSnap.data().name : "";

    const taskRef = await addDoc(collection(db, "tasks"), {
      title: item.text,
      description: `Action item from meeting: ${meeting.title}`,
      departmentId: assigneeProfile.departmentId,
      departmentName: deptName,
      assignedTo: item.assignedTo,
      assignedToName: item.assignedToName,
      createdBy: profile.uid,
      createdByName: profile.name,
      priority: "MEDIUM",
      startDate: null,
      deadline: null,
      status: "TO_DO",
      attachments: [],
      dependsOn: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const updatedItems = meeting.actionItems.map((ai) => (ai.id === item.id ? { ...ai, taskId: taskRef.id } : ai));
    await updateDoc(doc(db, "meetings", meeting.id), { actionItems: updatedItems });
    await notify({
      userId: item.assignedTo,
      title: "New task assigned",
      message: `"${item.text}" was assigned to you from a meeting`,
      type: "TASK_ASSIGNED",
      relatedId: taskRef.id,
      link: `/tasks/${taskRef.id}`,
    });
    toast.success("Converted to task");
    load();
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Meetings</h1>
          <p className="text-sm text-neutral-500">{meetings.length} meetings</p>
        </div>
        {canCreate && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Schedule Meeting
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No meetings scheduled" />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              users={users}
              expanded={expanded === m.id}
              onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
              onSaveNotes={saveNotes}
              onAddActionItem={addActionItem}
              onConvertToTask={convertToTask}
              canEdit={canCreate}
            />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule Meeting">
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Time" required>
              <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Location">
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </FormField>
          <FormField label="Agenda">
            <Textarea rows={3} value={form.agenda} onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))} />
          </FormField>
          <FormField label="Attendees">
            <select
              multiple
              value={form.attendees}
              onChange={(e) => setForm((f) => ({ ...f, attendees: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
              className="h-32 w-full rounded-lg border border-neutral-300 p-2 text-sm"
            >
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
              ))}
            </select>
          </FormField>
          <Button className="w-full" onClick={createMeeting} loading={saving} disabled={!form.title || !form.date}>
            Schedule Meeting
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function MeetingCard({
  meeting,
  users,
  expanded,
  onToggle,
  onSaveNotes,
  onAddActionItem,
  onConvertToTask,
  canEdit,
}: {
  meeting: Meeting;
  users: UserProfile[];
  expanded: boolean;
  onToggle: () => void;
  onSaveNotes: (m: Meeting, notes: string, decisions: string) => void;
  onAddActionItem: (m: Meeting, text: string, assignedTo: string) => void;
  onConvertToTask: (m: Meeting, item: ActionItem) => void;
  canEdit: boolean;
}) {
  const [notes, setNotes] = useState(meeting.notes);
  const [decisions, setDecisions] = useState(meeting.decisions);
  const [newItem, setNewItem] = useState("");
  const [newItemAssignee, setNewItemAssignee] = useState("");

  return (
    <Card>
      <CardContent className="py-4">
        <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
          <div>
            <p className="font-semibold text-neutral-900">{meeting.title}</p>
            <p className="text-xs text-neutral-500">{meeting.date} at {meeting.time} · {meeting.location || "No location set"}</p>
          </div>
        </button>
        {expanded && (
          <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
            {meeting.agenda && (
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-400">Agenda</p>
                <p className="text-sm text-neutral-700">{meeting.agenda}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">Attendees</p>
              <p className="text-sm text-neutral-700">
                {meeting.attendees.map((uid) => users.find((u) => u.uid === uid)?.name).filter(Boolean).join(", ") || "None"}
              </p>
            </div>

            {canEdit ? (
              <>
                <FormField label="Meeting Notes">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onSaveNotes(meeting, notes, decisions)} />
                </FormField>
                <FormField label="Decisions">
                  <Textarea rows={2} value={decisions} onChange={(e) => setDecisions(e.target.value)} onBlur={() => onSaveNotes(meeting, notes, decisions)} />
                </FormField>
              </>
            ) : (
              <>
                {meeting.notes && <div><p className="text-xs font-semibold uppercase text-neutral-400">Notes</p><p className="text-sm text-neutral-700">{meeting.notes}</p></div>}
                {meeting.decisions && <div><p className="text-xs font-semibold uppercase text-neutral-400">Decisions</p><p className="text-sm text-neutral-700">{meeting.decisions}</p></div>}
              </>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-400">Action Items</p>
              <div className="space-y-2">
                {meeting.actionItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                    <div>
                      <p className="text-neutral-800">{item.text}</p>
                      <p className="text-xs text-neutral-500">{item.assignedToName ?? "Unassigned"}</p>
                    </div>
                    {canEdit && !item.taskId && (
                      <Button size="sm" variant="outline" onClick={() => onConvertToTask(meeting, item)}>
                        Convert to Task
                      </Button>
                    )}
                    {item.taskId && <span className="text-xs text-emerald-600">Task created</span>}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-3 flex gap-2">
                  <Input placeholder="New action item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
                  <Select className="w-40" value={newItemAssignee} onChange={(e) => setNewItemAssignee(e.target.value)}>
                    <option value="">Assign to…</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newItem.trim()) return;
                      onAddActionItem(meeting, newItem.trim(), newItemAssignee);
                      setNewItem("");
                      setNewItemAssignee("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
