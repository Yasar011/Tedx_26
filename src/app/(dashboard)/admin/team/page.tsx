"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, Role, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

const ASSIGNABLE_ROLES: Role[] = ["admin", "core", "department_head", "volunteer", "applicant", "unassigned"];

export default function AdminTeamPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tedxIdDrafts, setTedxIdDrafts] = useState<Record<string, string>>({});

  async function load() {
    const [userSnap, deptSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "departments")),
    ]);
    setUsers(userSnap.docs.map((d) => d.data() as UserProfile).sort((a, b) => a.name?.localeCompare(b.name)));
    setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(user: UserProfile, role: Role) {
    await updateDoc(doc(db, "users", user.uid), { role });
    await logActivity({
      actorId: profile!.uid,
      actorName: profile!.name,
      action: "ROLE_CHANGED",
      targetType: "user",
      targetId: user.uid,
      message: `${profile!.name} set ${user.name}'s role to ${ROLE_LABELS[role]}`,
    });
    toast.success(`${user.name} is now ${ROLE_LABELS[role]}`);
    load();
  }

  async function setDepartment(user: UserProfile, departmentId: string) {
    await updateDoc(doc(db, "users", user.uid), { departmentId: departmentId || null });
    if (departmentId) {
      // headName is denormalised because applicants can't read other users'
      // profiles, but do need to see who runs a department before agreeing.
      // A Department Head always claims the slot; an Admin/Core member who
      // also holds the department claims it only when nobody else has, so
      // adding an admin to a team can't displace its real Head.
      const target = departments.find((d) => d.id === departmentId);
      const claimsHeadSlot =
        user.role === "department_head" ||
        ((user.role === "admin" || user.role === "core") && !target?.headUserId);

      if (claimsHeadSlot) {
        await updateDoc(doc(db, "departments", departmentId), {
          headUserId: user.uid,
          headName: user.name,
        });
      }
    }
    if (user.departmentId && user.departmentId !== departmentId) {
      await clearStaleDenormalisedNames(user);
    }
    toast.success(`${user.name}'s department updated`);
    load();
  }

  /** Drops this person's name from the department they just left. */
  async function clearStaleDenormalisedNames(user: UserProfile) {
    if (!user.departmentId) return;
    const previous = departments.find((d) => d.id === user.departmentId);
    if (!previous) return;
    const patch: Record<string, unknown> = {};
    if (previous.headName === user.name) {
      patch.headName = null;
      patch.headUserId = null;
    }
    if (previous.coHeadName === user.name) patch.coHeadName = null;
    if (Object.keys(patch).length > 0) {
      await updateDoc(doc(db, "departments", previous.id), patch);
    }
  }

  async function toggleCoHead(user: UserProfile) {
    const next = !user.isCoHead;
    await updateDoc(doc(db, "users", user.uid), { isCoHead: next });
    if (user.departmentId) {
      await updateDoc(doc(db, "departments", user.departmentId), {
        coHeadName: next ? user.name : null,
      });
    }
    await logActivity({
      actorId: profile!.uid,
      actorName: profile!.name,
      action: next ? "CO_HEAD_ASSIGNED" : "CO_HEAD_REMOVED",
      targetType: "user",
      targetId: user.uid,
      message: `${profile!.name} ${next ? "made" : "removed"} ${user.name} ${next ? "a" : "as"} Co-Head`,
      departmentId: user.departmentId,
    });
    toast.success(next ? `${user.name} is now a Co-Head` : `${user.name} is no longer a Co-Head`);
    load();
  }

  async function setTedxId(user: UserProfile, tedxId: string) {
    await updateDoc(doc(db, "users", user.uid), { tedxId: tedxId.trim() || null });
    await logActivity({
      actorId: profile!.uid,
      actorName: profile!.name,
      action: "TEDX_ID_OVERRIDDEN",
      targetType: "user",
      targetId: user.uid,
      message: `${profile!.name} manually set ${user.name}'s TEDx ID to "${tedxId.trim() || "none"}"`,
    });
    toast.success(`${user.name}'s TEDx ID updated`);
    load();
  }

  if (loading) return <FullPageSpinner />;

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Team Management</h1>
          <p className="text-sm text-neutral-500">{users.length} accounts</p>
        </div>
        <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No accounts yet" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Co-Head</th>
                    <th className="px-4 py-3">TEDx ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((u) => (
                    <tr key={u.uid}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                            {initials(u.name || u.email)}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900">{u.name}</p>
                            <p className="text-xs text-neutral-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.role}
                          onChange={(e) => setRole(u, e.target.value as Role)}
                          className="h-9 w-44"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.departmentId ?? ""}
                          onChange={(e) => setDepartment(u, e.target.value)}
                          className="h-9 w-44"
                          // Admin and Core can hold a department too — an org
                          // role doesn't preclude also running one.
                          disabled={u.role === "applicant" || u.role === "unassigned"}
                        >
                          <option value="">—</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="flex items-center gap-2 text-xs text-neutral-600">
                          <input
                            type="checkbox"
                            checked={!!u.isCoHead}
                            onChange={() => toggleCoHead(u)}
                            disabled={!u.departmentId || u.role === "department_head"}
                          />
                          Co-Head
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          className="h-9 w-36"
                          value={tedxIdDrafts[u.uid] ?? u.tedxId ?? ""}
                          onChange={(e) => setTedxIdDrafts((d) => ({ ...d, [u.uid]: e.target.value }))}
                          onBlur={(e) => {
                            if (e.target.value !== (u.tedxId ?? "")) setTedxId(u, e.target.value);
                          }}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
