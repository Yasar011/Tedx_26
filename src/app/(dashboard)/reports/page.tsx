"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ActivityLog, ApplicationStatus, Department, Task } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import { APPLICATION_STATUS_LABELS } from "@/lib/constants";

type Tab = "recruitment" | "department" | "activity";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("recruitment");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500">Recruitment, department, and activity insights.</p>
      </div>

      <div className="flex gap-2">
        {(["recruitment", "department", "activity"] as Tab[]).map((t) => (
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
      const appsRef = collection(db, "applications");
      const statuses = Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[];
      const [totalCount, ...statusCounts] = await Promise.all([
        getCountFromServer(appsRef),
        ...statuses.map((s) => getCountFromServer(query(appsRef, where("status", "==", s)))),
      ]);
      setTotal(totalCount.data().count);
      const statusMap: Record<string, number> = {};
      statuses.forEach((s, i) => (statusMap[s] = statusCounts[i].data().count));
      setByStatus(statusMap);

      const deptSnap = await getDocs(collection(db, "departments"));
      const depts = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      const deptCounts = await Promise.all(
        depts.map((d) => getCountFromServer(query(appsRef, where("departmentPreference", "==", d.name))))
      );
      setByDept(depts.map((d, i) => ({ name: d.name, count: deptCounts[i].data().count })));
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

function DepartmentReport() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    { department: Department; volunteers: number; tasks: number; completed: number; overdue: number }[]
  >([]);

  useEffect(() => {
    (async () => {
      const deptSnap = await getDocs(collection(db, "departments"));
      const depts = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      const results = await Promise.all(
        depts.map(async (department) => {
          const [volSnap, taskSnap] = await Promise.all([
            getCountFromServer(query(collection(db, "users"), where("departmentId", "==", department.id), where("role", "==", "volunteer"))),
            getDocs(query(collection(db, "tasks"), where("departmentId", "==", department.id))),
          ]);
          const tasks = taskSnap.docs.map((d) => d.data() as Task);
          const completed = tasks.filter((t) => t.status === "COMPLETED").length;
          const overdue = tasks.filter((t) => t.deadline && t.deadline < Date.now() && t.status !== "COMPLETED").length;
          return { department, volunteers: volSnap.data().count, tasks: tasks.length, completed, overdue };
        })
      );
      setRows(results);
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
      const [logSnap, deptSnap] = await Promise.all([
        getDocs(collection(db, "activityLogs")),
        getDocs(collection(db, "departments")),
      ]);
      setLogs(logSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)).sort((a, b) => b.createdAt - a.createdAt));
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
