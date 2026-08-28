"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, UserProfile } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function VolunteerPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [head, setHead] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (profile.departmentId) {
        const deptSnap = await getDoc(doc(db, "departments", profile.departmentId));
        if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);

        const headSnap = await getDocs(
          query(
            collection(db, "users"),
            where("departmentId", "==", profile.departmentId),
            where("role", "==", "department_head")
          )
        );
        if (!headSnap.empty) setHead(headSnap.docs[0].data() as UserProfile);
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>About {department?.name ?? "your department"}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-700">
          <p>{department?.description || "No description added yet."}</p>
          {department?.guidelines && (
            <div>
              <p className="font-medium text-neutral-900">Guidelines</p>
              <p className="text-neutral-600">{department.guidelines}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My Tasks</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500">
            Task management is coming in Phase 2 — assigned tasks, deadlines, and submissions will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
