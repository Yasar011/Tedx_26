"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, Task, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { initials } from "@/lib/utils";
import { computeDepartmentHealth } from "@/lib/departmentHealth";

export default function DepartmentPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  // Admin and Core oversee the whole organisation, so they can switch
  // between departments rather than being pinned to their own.
  const canBrowseAll = profile?.role === "admin" || profile?.role === "core";
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const viewingId = selectedId ?? profile?.departmentId ?? null;
  const [togglingIntake, setTogglingIntake] = useState(false);

  async function toggleIntake() {
    if (!department || !profile) return;
    setTogglingIntake(true);
    try {
      const next = !department.applicationsOpen;
      await updateDoc(doc(db, "departments", department.id), { applicationsOpen: next });
      setDepartment({ ...department, applicationsOpen: next });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: next ? "DEPT_APPLICATIONS_OPENED" : "DEPT_APPLICATIONS_CLOSED",
        targetType: "department",
        targetId: department.id,
        message: `${profile.name} ${next ? "opened" : "closed"} applications for ${department.name}`,
        departmentId: department.id,
      });
      toast.success(next ? "Applications opened" : "Applications closed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setTogglingIntake(false);
    }
  }

  useEffect(() => {
    if (!canBrowseAll) return;
    (async () => {
      const snap = await getDocs(collection(db, "departments"));
      const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      setAllDepartments(depts);
      // Admins with no department of their own still get a view.
      setSelectedId((cur) => cur ?? profile?.departmentId ?? depts[0]?.id ?? null);
    })();
  }, [canBrowseAll, profile?.departmentId]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (!viewingId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const deptSnap = await getDoc(doc(db, "departments", viewingId));
      if (deptSnap.exists()) {
        setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);
      }
      const [teamSnap, taskSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("departmentId", "==", viewingId))),
        getDocs(query(collection(db, "tasks"), where("departmentId", "==", viewingId))),
      ]);
      const members = teamSnap.docs.map((d) => d.data() as UserProfile);
      setTeam(members);
      setTasks(taskSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);

      // Self-heal the denormalised lead names. Applicants can't read user
      // profiles, so the agreement step relies entirely on these fields —
      // if they're missing it tells applicants "no Head assigned" even when
      // one clearly exists. Backfills silently when someone with access
      // opens the page.
      if (deptSnap.exists()) {
        const dept = { id: deptSnap.id, ...deptSnap.data() } as Department;
        const lead =
          members.find((m) => m.role === "department_head") ??
          members.find((m) => m.role === "admin" || m.role === "core");
        const coLead = members.find((m) => m.isCoHead && m.uid !== lead?.uid);

        const patch: Record<string, unknown> = {};
        if (lead && dept.headName !== lead.name) {
          patch.headName = lead.name;
          patch.headUserId = lead.uid;
        }
        if ((coLead?.name ?? null) !== (dept.coHeadName ?? null)) {
          patch.coHeadName = coLead?.name ?? null;
        }
        if (Object.keys(patch).length > 0) {
          try {
            await updateDoc(doc(db, "departments", viewingId), patch);
            setDepartment({ ...dept, ...patch } as Department);
          } catch {
            /* non-fatal: only Admin/Head can write, and the page still renders */
          }
        }
      }
    })();
  }, [profile, viewingId]);

  if (loading) return <FullPageSpinner />;

  if (!department) {
    return (
      <EmptyState
        icon={Building2}
        title={canBrowseAll ? "No departments yet" : "No department assigned"}
        description={
          canBrowseAll
            ? "Create a department from Admin → Departments to see its workspace here."
            : "You haven't been assigned to a department yet. Contact an Admin."
        }
      />
    );
  }

  // The department may be run by a dedicated Department Head, or by an
  // Admin/Core member who also holds this department.
  const head =
    team.find((t) => t.role === "department_head") ??
    team.find((t) => t.role === "admin" || t.role === "core");
  const headLabel = head?.role === "department_head" ? "Department Head" : "Department Lead";
  const coHead = team.find((t) => t.isCoHead && t.uid !== head?.uid);
  const volunteers = team.filter((t) => t.role === "volunteer" && t.uid !== coHead?.uid);
  const health = computeDepartmentHealth(tasks);
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{department.name}</h1>
          <p className="text-sm text-neutral-500">
            Department code: {department.code}
            {profile?.departmentId === department.id && canBrowseAll && " · your department"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {canBrowseAll && allDepartments.length > 1 && (
            <Select
              className="w-52"
              value={viewingId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {allDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.id === profile?.departmentId ? " (mine)" : ""}
                </option>
              ))}
            </Select>
          )}
          <div className="text-right">
            <p className="text-2xl">{health.emoji} {health.score}%</p>
            <p className="text-xs text-neutral-500">{health.label}</p>
          </div>
        </div>
      </div>

      {/* Heads control their own intake; Admin keeps the global switch in
          Settings. Shown here so it's where the Head actually works. */}
      <Card className={department.applicationsOpen ? "border-emerald-200" : "border-amber-200"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              Applications are {department.applicationsOpen ? "OPEN" : "CLOSED"} for{" "}
              {department.name}
            </p>
            <p className="text-xs text-neutral-500">
              {department.applicationsOpen
                ? "Students can pick this department on the application form."
                : "This department is hidden from the application form."}
            </p>
          </div>
          <Button
            variant={department.applicationsOpen ? "outline" : "primary"}
            loading={togglingIntake}
            onClick={toggleIntake}
          >
            {department.applicationsOpen ? "Close applications" : "Open applications"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/tasks">
          <Card className="hover:border-neutral-300">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-neutral-400">Tasks</p>
              <p className="text-lg font-semibold text-neutral-900">{completedTasks}/{tasks.length} completed</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/files">
          <Card className="hover:border-neutral-300">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-neutral-400">Files</p>
              <p className="text-lg font-semibold text-neutral-900">View department files</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/announcements">
          <Card className="hover:border-neutral-300">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-neutral-400">Announcements</p>
              <p className="text-lg font-semibold text-neutral-900">Post & view updates</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About this department</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-neutral-700">
          <p>{department.description || "No description added yet."}</p>
          {department.purpose && (
            <div>
              <p className="font-medium text-neutral-900">Purpose</p>
              <p className="text-neutral-600">{department.purpose}</p>
            </div>
          )}
          {department.responsibilities && (
            <div>
              <p className="font-medium text-neutral-900">Responsibilities</p>
              <p className="text-neutral-600">{department.responsibilities}</p>
            </div>
          )}
          {department.guidelines && (
            <div>
              <p className="font-medium text-neutral-900">Guidelines</p>
              <p className="text-neutral-600">{department.guidelines}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team ({team.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {(head || coHead) && (
            <div className="mb-4 flex flex-wrap gap-6">
              {head && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EB0028] text-xs font-semibold text-white">
                    {initials(head.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{head.name}</p>
                    <p className="text-xs text-neutral-500">{headLabel}</p>
                  </div>
                </div>
              )}
              {coHead && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-white">
                    {initials(coHead.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{coHead.name}</p>
                    <p className="text-xs text-neutral-500">Co-Head</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {volunteers.length === 0 ? (
            <p className="text-sm text-neutral-500">No volunteers onboarded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {volunteers.map((v) => (
                <div key={v.uid} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                    {initials(v.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{v.name}</p>
                    <p className="text-xs text-neutral-500">{v.tedxId ?? "Volunteer"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
