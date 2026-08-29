"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Announcement, Department, Task, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default function VolunteerPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [head, setHead] = useState<UserProfile | null>(null);
  const [coHead, setCoHead] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (profile.departmentId) {
        const deptSnap = await getDoc(doc(db, "departments", profile.departmentId));
        if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);

        const [teamSnap, taskSnap, orgAnnSnap, deptAnnSnap] = await Promise.all([
          getDocs(query(collection(db, "users"), where("departmentId", "==", profile.departmentId))),
          getDocs(query(collection(db, "tasks"), where("assignedTo", "==", profile.uid))),
          getDocs(query(collection(db, "announcements"), where("scope", "==", "org"))),
          // Single-field: org announcements have a null departmentId, so this
          // needs no composite index.
          getDocs(query(collection(db, "announcements"), where("departmentId", "==", profile.departmentId))),
        ]);
        const team = teamSnap.docs.map((d) => d.data() as UserProfile);
        const foundHead = team.find((t) => t.role === "department_head") ?? null;
        setHead(foundHead);
        setCoHead(team.find((t) => t.isCoHead && t.uid !== foundHead?.uid) ?? null);
        setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)).sort((a, b) => b.createdAt - a.createdAt));
        const anns = [
          ...orgAnnSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)),
          ...deptAnnSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)),
        ].sort((a, b) => b.createdAt - a.createdAt);
        setAnnouncements(anns.slice(0, 5));
      }
      setLoading(false);
    })();
  }, [profile]);

  if (loading || !profile) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Welcome, {profile.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-neutral-500">Here&apos;s your TEDxNIFT Jodhpur snapshot.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">TEDx Member ID</p>
            <p className="text-2xl font-bold tracking-tight text-[#EB0028]">{profile.tedxId ?? "Pending"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Department</p>
            <p className="text-lg font-semibold text-neutral-900">{department?.name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Department Head</p>
            <p className="text-lg font-semibold text-neutral-900">{head?.name ?? "—"}</p>
          </div>
          {coHead && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Co-Head</p>
              <p className="text-lg font-semibold text-neutral-900">{coHead.name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>My Tasks</CardTitle>
          <Link href="/tasks" className="text-xs text-[#EB0028] hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-neutral-500">No tasks assigned yet.</p>
          ) : (
            tasks.slice(0, 5).map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-50">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                  {task.deadline && <p className="text-xs text-neutral-500">Due {formatDate(task.deadline)}</p>}
                </div>
                <Badge className={TASK_STATUS_COLORS[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Announcements</CardTitle>
          <Link href="/announcements" className="text-xs text-[#EB0028] hover:underline">View all</Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-neutral-500">No announcements yet.</p>
          ) : (
            announcements.map((a) => (
              <div key={a.id}>
                <p className="text-sm font-medium text-neutral-900">{a.title}</p>
                <p className="text-xs text-neutral-500 line-clamp-1">{a.message}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
