"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ActivityLog, Department, Task } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { formatDateTime } from "@/lib/utils";
import { computeDepartmentHealth } from "@/lib/departmentHealth";
import {
  Users,
  UserCheck,
  FileText,
  Clock,
  CheckSquare,
  Building2,
  ListTodo,
  AlertTriangle,
} from "lucide-react";

interface Stats {
  coreTeam: number;
  volunteers: number;
  applicants: number;
  pendingApplications: number;
  pendingInterviews: number;
  pendingApprovals: number;
  activeTasks: number;
  overdueTasks: number;
  openIssues: number;
}

interface DeptHealth {
  department: Department;
  approved: number;
  total: number;
}

interface DeptTaskHealth {
  department: Department;
  score: number;
  label: string;
  emoji: string;
}

export default function CommandCenterPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [deptHealth, setDeptHealth] = useState<DeptHealth[]>([]);
  const [deptTaskHealth, setDeptTaskHealth] = useState<DeptTaskHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const usersRef = collection(db, "users");
      const appsRef = collection(db, "applications");

      const [
        coreCount,
        volCount,
        applicantCount,
        pendingAppsCount,
        pendingInterviewCount,
        pendingApprovalCount,
        deptSnap,
        activitySnap,
        allTasksSnap,
        openIssuesCount,
      ] = await Promise.all([
        getCountFromServer(query(usersRef, where("role", "in", ["admin", "core"]))),
        getCountFromServer(query(usersRef, where("role", "==", "volunteer"))),
        getCountFromServer(query(usersRef, where("role", "==", "applicant"))),
        getCountFromServer(query(appsRef, where("status", "in", ["SUBMITTED", "UNDER_REVIEW"]))),
        getCountFromServer(query(appsRef, where("status", "==", "INTERVIEW_SCHEDULED"))),
        getCountFromServer(query(appsRef, where("status", "==", "CORE_REVIEW"))),
        getDocs(collection(db, "departments")),
        getDocs(query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(12))),
        getDocs(collection(db, "tasks")),
        getCountFromServer(
          query(collection(db, "issues"), where("status", "in", ["REPORTED", "ASSIGNED", "IN_PROGRESS"]))
        ),
      ]);

      const allTasks = allTasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
      const activeTasks = allTasks.filter((t) => t.status !== "COMPLETED").length;
      const overdueTasks = allTasks.filter((t) => t.deadline && t.deadline < Date.now() && t.status !== "COMPLETED").length;

      setStats({
        coreTeam: coreCount.data().count,
        volunteers: volCount.data().count,
        applicants: applicantCount.data().count,
        pendingApplications: pendingAppsCount.data().count,
        pendingInterviews: pendingInterviewCount.data().count,
        pendingApprovals: pendingApprovalCount.data().count,
        activeTasks,
        overdueTasks,
        openIssues: openIssuesCount.data().count,
      });

      const departments = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      const health = await Promise.all(
        departments.map(async (department) => {
          const [totalSnap, approvedSnap] = await Promise.all([
            getCountFromServer(query(appsRef, where("departmentPreference", "==", department.name))),
            getCountFromServer(
              query(appsRef, where("departmentPreference", "==", department.name), where("status", "==", "APPROVED"))
            ),
          ]);
          return { department, total: totalSnap.data().count, approved: approvedSnap.data().count };
        })
      );
      setDeptHealth(health);

      setDeptTaskHealth(
        departments.map((department) => {
          const deptTasks = allTasks.filter((t) => t.departmentId === department.id);
          const { score, label, emoji } = computeDepartmentHealth(deptTasks);
          return { department, score, label, emoji };
        })
      );

      setActivity(activitySnap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) return <FullPageSpinner />;

  const cards = [
    { label: "Core Organizing Team", value: stats.coreTeam, icon: Users },
    { label: "Volunteers", value: stats.volunteers, icon: UserCheck },
    { label: "Applicants", value: stats.applicants, icon: FileText },
    { label: "Pending Applications", value: stats.pendingApplications, icon: Clock },
    { label: "Pending Interviews", value: stats.pendingInterviews, icon: Clock },
    { label: "Pending Core Approvals", value: stats.pendingApprovals, icon: CheckSquare },
    { label: "Active Tasks", value: stats.activeTasks, icon: ListTodo },
    { label: "Overdue Tasks", value: stats.overdueTasks, icon: AlertTriangle },
    { label: "Open Issues", value: stats.openIssues, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Admin Command Center</h1>
        <p className="text-sm text-neutral-500">Live status across the organization.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="py-5">
              <c.icon className="mb-2 h-4 w-4 text-neutral-400" />
              <p className="text-2xl font-bold text-neutral-900">{c.value}</p>
              <p className="text-xs text-neutral-500">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Department Recruitment Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {deptHealth.length === 0 && <p className="text-sm text-neutral-500">No departments configured yet.</p>}
            {deptHealth.map(({ department, total, approved }) => {
              const pct = total === 0 ? 0 : Math.round((approved / total) * 100);
              const color = pct >= 60 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";
              return (
                <div key={department.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-neutral-800">{department.name}</span>
                    <span className="text-neutral-500">{approved}/{total} approved · {pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Department Health (Tasks)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deptTaskHealth.length === 0 && <p className="text-sm text-neutral-500">No departments configured yet.</p>}
            {deptTaskHealth.map(({ department, score, label, emoji }) => (
              <div key={department.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-800">{department.name}</span>
                <span className="text-neutral-500">{emoji} {score}% · {label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-neutral-500">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                    <div>
                      <p className="text-neutral-800">{a.message}</p>
                      <p className="text-xs text-neutral-400">{formatDateTime(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
