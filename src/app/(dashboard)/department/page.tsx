"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2 } from "lucide-react";
import { initials } from "@/lib/utils";

export default function DepartmentPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (!profile.departmentId) {
        setLoading(false);
        return;
      }
      const deptSnap = await getDoc(doc(db, "departments", profile.departmentId));
      if (deptSnap.exists()) {
        setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);
      }
      const teamSnap = await getDocs(
        query(collection(db, "users"), where("departmentId", "==", profile.departmentId))
      );
      setTeam(teamSnap.docs.map((d) => d.data() as UserProfile));
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <FullPageSpinner />;

  if (!department) {
    return (
      <EmptyState
        icon={Building2}
        title="No department assigned"
        description="You haven't been assigned to a department yet. Contact an Admin."
      />
    );
  }

  const head = team.find((t) => t.role === "department_head");
  const volunteers = team.filter((t) => t.role === "volunteer");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{department.name}</h1>
        <p className="text-sm text-neutral-500">Department code: {department.code}</p>
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
          {head && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EB0028] text-xs font-semibold text-white">
                {initials(head.name)}
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{head.name}</p>
                <p className="text-xs text-neutral-500">Department Head</p>
              </div>
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
