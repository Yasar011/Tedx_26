"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, Task, TaskPriority, TaskStatus, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { TASK_PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { isDeptLead } from "@/lib/permissions";
import { toast } from "sonner";
import { ClipboardList, Plus } from "lucide-react";

const STATUS_COLUMNS: TaskStatus[] = [
  "TO_DO",
  "IN_PROGRESS",
  "SUBMITTED_FOR_REVIEW",
  "REVISION_REQUIRED",
  "APPROVED",
  "COMPLETED",
];

const emptyForm = {
  title: "",
  description: "",
  assignedTo: "",
  priority: "MEDIUM" as TaskPriority,
  startDate: "",
  deadline: "",
  dependsOn: "",
};

export default function TasksPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [volunteers, setVolunteers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = isDeptLead(profile) || profile?.role === "admin";

  async function load() {
    if (!profile) return;
    if (profile.role === "admin" || profile.role === "core") {
      const snap = await getDocs(collection(db, "tasks"));
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)).sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
      return;
    }
    if (!profile.departmentId) {
      setLoading(false);
      return;
    }
    const deptSnap = await getDoc(doc(db, "departments", profile.departmentId));
    if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);

    // Both queries filter on departmentId alone and narrow further in
    // memory. Adding a second where() would require composite indexes
    // (departmentId+assignedTo, departmentId+role) that aren't guaranteed
    // to be deployed, and the per-department volumes here are small.
    const [taskSnap, teamSnap] = await Promise.all([
      getDocs(query(collection(db, "tasks"), where("departmentId", "==", profile.departmentId))),
      getDocs(query(collection(db, "users"), where("departmentId", "==", profile.departmentId))),
    ]);

    const deptTasks = taskSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Task))
      .sort((a, b) => b.createdAt - a.createdAt);

    // Volunteers only see their own assignments; department leads see all.
    setTasks(isDeptLead(profile) ? deptTasks : deptTasks.filter((t) => t.assignedTo === profile.uid));
    setVolunteers(teamSnap.docs.map((d) => d.data() as UserProfile).filter((u) => u.role === "volunteer"));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function createTask() {
    if (!profile || !department) return;
    setSaving(true);
    try {
      const assignee = volunteers.find((v) => v.uid === form.assignedTo);
      const ref = await addDoc(collection(db, "tasks"), {
        title: form.title,
        description: form.description,
        departmentId: department.id,
        departmentName: department.name,
        assignedTo: form.assignedTo || null,
        assignedToName: assignee?.name ?? null,
        createdBy: profile.uid,
        createdByName: profile.name,
        priority: form.priority,
        startDate: form.startDate ? new Date(form.startDate).getTime() : null,
        deadline: form.deadline ? new Date(form.deadline).getTime() : null,
        status: "TO_DO",
        attachments: [],
        dependsOn: form.dependsOn || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "TASK_CREATED",
        targetType: "task",
        targetId: ref.id,
        message: `${profile.name} created task "${form.title}"${assignee ? ` for ${assignee.name}` : ""}`,
        departmentId: department.id,
      });
      if (assignee) {
        await notify({
          userId: assignee.uid,
          title: "New task assigned",
          message: `"${form.title}" was assigned to you`,
          type: "TASK_ASSIGNED",
          relatedId: ref.id,
          link: `/tasks/${ref.id}`,
        });
      }
      toast.success("Task created");
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  if (!department && profile?.role !== "admin" && profile?.role !== "core") {
    return <EmptyState icon={ClipboardList} title="No department assigned" description="Contact an Admin to get assigned to a department." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            {profile?.role === "admin" || profile?.role === "core" ? "All Tasks" : "Tasks"}
            {department && ` — ${department.name}`}
          </h1>
          <p className="text-sm text-neutral-500">{tasks.length} tasks</p>
        </div>
        {canManage && department && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New Task
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No tasks yet" description="Create the first task for your department." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STATUS_COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            if (columnTasks.length === 0) return null;
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-700">{TASK_STATUS_LABELS[status]}</h2>
                  <span className="text-xs text-neutral-400">{columnTasks.length}</span>
                </div>
                {columnTasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <Card className="hover:border-neutral-300">
                      <CardContent className="space-y-2 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                          <Badge className={TASK_PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                        </div>
                        <p className="text-xs text-neutral-500">
                          {task.assignedToName ?? "Unassigned"}
                          {task.deadline && ` · Due ${formatDate(task.deadline)}`}
                        </p>
                        <Badge className={TASK_STATUS_COLORS[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Task">
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Assign to">
            <Select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
              <option value="">Unassigned</option>
              {volunteers.map((v) => (
                <option key={v.uid} value={v.uid}>{v.name}</option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </FormField>
            <FormField label="Depends on">
              <Select value={form.dependsOn} onChange={(e) => setForm((f) => ({ ...f, dependsOn: e.target.value }))}>
                <option value="">None</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date">
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </FormField>
            <FormField label="Deadline">
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </FormField>
          </div>
          <Button className="w-full" onClick={createTask} loading={saving} disabled={!form.title}>
            Create Task
          </Button>
        </div>
      </Modal>
    </div>
  );
}
