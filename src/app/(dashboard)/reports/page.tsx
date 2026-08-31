"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  ActivityLog,
  Interview,
  Application,
  ApplicationStatus,
  Department,
  Task,
  UserProfile,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { getEmailQuota } from "@/lib/email";

type Tab = "recruitment" | "interviews" | "department" | "activity";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("recruitment");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500">Recruitment, department, and activity insights.</p>
      </div>

      <div className="flex gap-2">
        {(["recruitment", "interviews", "department", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "recruitment" && <RecruitmentReport />}
      {tab === "interviews" && <InterviewReport />}
      {tab === "department" && <DepartmentReport />}
      {tab === "activity" && <ActivityReport />}
    </div>
  );
}

function RecruitmentReport() {
  const [loading, setLoading] = useState(true);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [byDept, setByDept] = useState<{ name: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      // Two reads instead of one-per-status plus one-per-department; the
      // whole breakdown is a grouping of the same application list.
      const [appsSnap, deptSnap] = await Promise.all([
        getDocs(collection(db, "applications")),
        getDocs(collection(db, "departments")),
      ]);

      const apps = appsSnap.docs.map((d) => d.data() as Application);
      const statuses = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];

      setTotal(apps.length);
      const statusMap: Record<string, number> = {};
      statuses.forEach((s) => {
        statusMap[s] = apps.filter((a) => a.status === s).length;
      });
      setByStatus(statusMap);

      const depts = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      setByDept(
        depts.map((d) => ({
          name: d.name,
          count: apps.filter((a) => a.departmentPreference === d.name).length,
        }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <FullPageSpinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Applications by Status ({total} total)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">{APPLICATION_STATUS_LABELS[status as ApplicationStatus]}</span>
              <span className="font-semibold text-neutral-900">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Applications by Department</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {byDept.map((d) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">{d.name}</span>
              <span className="font-semibold text-neutral-900">{d.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InterviewReport() {
  const [loading, setLoading] = useState(true);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "interviews"));
      setInterviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Interview)));
      setLoading(false);
    })();
    getEmailQuota().then(setQuota);
  }, []);

  if (loading) return <FullPageSpinner />;

  const scheduled = interviews.filter((i) => i.scheduledAt);
  const confirmed = scheduled.filter((i) => i.applicantAccepted === true);
  const declined = scheduled.filter((i) => i.applicantAccepted === false);
  const awaiting = scheduled.filter((i) => i.applicantAccepted == null);
  const attended = scheduled.filter((i) => i.attended === true);
  const noShow = scheduled.filter((i) => i.attended === false);
  const unrecorded = scheduled.filter((i) => i.attended == null);
  const assessed = interviews.filter((i) => i.submittedAt);

  const stats = [
    { label: "Interviews scheduled", value: scheduled.length, tone: "" },
    { label: "Confirmed by applicant", value: confirmed.length, tone: "text-emerald-700" },
    { label: "Awaiting confirmation", value: awaiting.length, tone: "text-amber-700" },
    { label: "Declined the slot", value: declined.length, tone: "text-red-700" },
    { label: "Attended", value: attended.length, tone: "text-emerald-700" },
    { label: "No-shows", value: noShow.length, tone: "text-red-700" },
    { label: "Attendance not recorded", value: unrecorded.length, tone: "text-neutral-500" },
    { label: "Assessed & sent to Core", value: assessed.length, tone: "" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-5">
              <p className={`text-2xl font-bold ${s.tone || "text-neutral-900"}`}>{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Applicant emails</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-700">
          <p>
            {quota === null
              ? "The email relay isn't reachable right now."
              : `${quota} sends left today.`}
          </p>
          {/* Every send is written to the Sheet by the Apps Script, which is
              the authoritative record — the app never stores a copy. */}
          <p className="text-neutral-500">
            A full log of every email — who it went to, the subject and whether it
            sent — is written to your Google Sheet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DepartmentReport() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    { department: Department; volunteers: number; tasks: number; completed: number; overdue: number }[]
  >([]);

  useEffect(() => {
    (async () => {
      // One read per collection, then group in memory — previously this
      // issued 2 queries per department after the department list resolved.
      const [deptSnap, userSnap, taskSnap] = await Promise.all([
        getDocs(collection(db, "departments")),
        getDocs(query(collection(db, "users"), where("role", "==", "volunteer"))),
        getDocs(collection(db, "tasks")),
      ]);

      const depts = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      const volunteers = userSnap.docs.map((d) => d.data() as UserProfile);
      const allTasks = taskSnap.docs.map((d) => d.data() as Task);
      const now = Date.now();

      setRows(
        depts.map((department) => {
          const tasks = allTasks.filter((t) => t.departmentId === department.id);
          return {
            department,
            volunteers: volunteers.filter((v) => v.departmentId === department.id).length,
            tasks: tasks.length,
            completed: tasks.filter((t) => t.status === "COMPLETED").length,
            overdue: tasks.filter((t) => t.deadline && t.deadline < now && t.status !== "COMPLETED").length,
          };
        })
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <FullPageSpinner />;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Volunteers</th>
                <th className="px-4 py-3">Tasks</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Overdue</th>
                <th className="px-4 py-3">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const pct = r.tasks === 0 ? 0 : Math.round((r.completed / r.tasks) * 100);
                return (
                  <tr key={r.department.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{r.department.name}</td>
                    <td className="px-4 py-3">{r.volunteers}</td>
                    <td className="px-4 py-3">{r.tasks}</td>
                    <td className="px-4 py-3">{r.completed}</td>
                    <td className="px-4 py-3 text-red-600">{r.overdue}</td>
                    <td className="px-4 py-3">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityReport() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      // Bounded + server-sorted. This collection grows on every login and
      // every action, so reading it whole would get slower without limit.
      const [logSnap, deptSnap] = await Promise.all([
        getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(200))),
        getDocs(collection(db, "departments")),
      ]);
      setLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
      setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
      setLoading(false);
    })();
  }, []);

  if (loading) return <FullPageSpinner />;

  const filtered = deptFilter === "ALL" ? logs : logs.filter((l) => l.departmentId === deptFilter);

  return (
    <div className="space-y-4">
      <Select className="w-56" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
        <option value="ALL">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </Select>
      <Card>
        <CardContent className="divide-y divide-neutral-100 p-0">
          {filtered.slice(0, 100).map((log) => (
            <div key={log.id} className="px-4 py-3 text-sm">
              <p className="text-neutral-800">{log.message}</p>
              <p className="text-xs text-neutral-400">{formatDateTime(log.createdAt)}</p>
            </div>
          ))}
          {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-neutral-500">No activity recorded.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
