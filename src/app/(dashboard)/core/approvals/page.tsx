"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, Department, Interview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { generateTedxId } from "@/lib/tedxId";
import { toast } from "sonner";
import { CheckSquare } from "lucide-react";

interface Row {
  application: Application;
  interview: Interview | null;
}

export default function ApprovalCenterPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  async function load() {
    const [appSnap, deptSnap] = await Promise.all([
      getDocs(query(collection(db, "applications"), where("status", "==", "CORE_REVIEW"))),
      getDocs(collection(db, "departments")),
    ]);
    const depts = deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
    setDepartments(depts);

    const apps = appSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Application));
    const rowsData: Row[] = await Promise.all(
      apps.map(async (application) => {
        const ivSnap = await getDocs(
          query(collection(db, "interviews"), where("applicationId", "==", application.id))
        );
        const interview = ivSnap.empty
          ? null
          : ({ id: ivSnap.docs[0].id, ...ivSnap.docs[0].data() } as Interview);
        return { application, interview };
      })
    );
    setRows(rowsData.sort((a, b) => b.application.updatedAt - a.application.updatedAt));
    setLoading(false);
  }

  useEffect(() => {
    load();
     
  }, []);

  async function decide(row: Row, decision: "APPROVED" | "REJECTED" | "WAITLISTED" | "SENT_BACK") {
    if (!profile) return;
    setBusyId(row.application.id);
    const comment = comments[row.application.id] ?? "";
    try {
      if (decision === "APPROVED") {
        const dept = departments.find((d) => d.name === row.application.departmentPreference);
        if (!dept) {
          toast.error("Could not resolve department code for this applicant");
          return;
        }
        const tedxId = await generateTedxId(dept.code);
        await updateDoc(doc(db, "users", row.application.applicantUserId), {
          role: "volunteer",
          departmentId: dept.id,
          tedxId,
          status: "active",
        });
        await updateDoc(doc(db, "applications", row.application.id), {
          status: "APPROVED",
          updatedAt: Date.now(),
        });
        await logActivity({
          actorId: profile.uid,
          actorName: profile.name,
          action: "APPLICATION_APPROVED",
          targetType: "application",
          targetId: row.application.id,
          message: `${row.application.name} approved by ${profile.name} — TEDx ID ${tedxId} generated`,
          departmentId: dept.id,
        });
        toast.success(`${row.application.name} approved — ${tedxId}`);
      } else {
        const statusMap = {
          REJECTED: "REJECTED",
          WAITLISTED: "WAITLISTED",
          SENT_BACK: "INTERVIEW_SCHEDULED",
        } as const;
        await updateDoc(doc(db, "applications", row.application.id), {
          status: statusMap[decision],
          updatedAt: Date.now(),
        });
        await logActivity({
          actorId: profile.uid,
          actorName: profile.name,
          action: `APPLICATION_${decision}`,
          targetType: "application",
          targetId: row.application.id,
          message: `${row.application.name} marked ${decision} by ${profile.name}${comment ? `: ${comment}` : ""}`,
        });
        toast.success(`${row.application.name} marked ${decision.toLowerCase()}`);
      }
      if (row.interview) {
        await updateDoc(doc(db, "interviews", row.interview.id), {
          coreDecision: {
            decidedBy: profile.uid,
            decidedByName: profile.name,
            decision,
            comment,
            decidedAt: Date.now(),
          },
        });
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Approval Center</h1>
        <p className="text-sm text-neutral-500">
          {rows.length} application{rows.length !== 1 && "s"} awaiting Core Team decision
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nothing pending" description="All caught up — no applications are waiting for Core approval." />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.application.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{row.application.name}</CardTitle>
                <Badge className="bg-amber-100 text-amber-700">
                  {row.application.departmentPreference}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Email" value={row.application.email} />
                  <Field label="Phone" value={row.application.phone} />
                  <Field label="Programme" value={row.application.programme} />
                  <Field label="Why TEDx?" value={row.application.why} />
                </div>

                {row.interview && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Interview by {row.interview.interviewerName}
                      {row.interview.submittedAt && ` · ${formatDateTime(row.interview.submittedAt)}`}
                    </p>
                    {row.interview.ratings && (
                      <div className="mb-2 flex flex-wrap gap-3 text-xs text-neutral-600">
                        {Object.entries(row.interview.ratings).map(([k, v]) => (
                          <span key={k} className="rounded bg-white px-2 py-1 border border-neutral-200">
                            {k}: {v}/5
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-neutral-700">{row.interview.notes}</p>
                    <p className="mt-2 text-sm font-medium">
                      Recommendation:{" "}
                      <span
                        className={
                          row.interview.recommendation === "SELECT"
                            ? "text-emerald-600"
                            : row.interview.recommendation === "REJECT"
                            ? "text-red-600"
                            : "text-amber-600"
                        }
                      >
                        {row.interview.recommendation}
                      </span>
                    </p>
                  </div>
                )}

                <Textarea
                  placeholder="Optional comment for this decision"
                  rows={2}
                  value={comments[row.application.id] ?? ""}
                  onChange={(e) =>
                    setComments((c) => ({ ...c, [row.application.id]: e.target.value }))
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    loading={busyId === row.application.id}
                    onClick={() => decide(row, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    loading={busyId === row.application.id}
                    onClick={() => decide(row, "REJECTED")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    loading={busyId === row.application.id}
                    onClick={() => decide(row, "WAITLISTED")}
                  >
                    Waitlist
                  </Button>
                  <Button
                    variant="ghost"
                    loading={busyId === row.application.id}
                    onClick={() => decide(row, "SENT_BACK")}
                  >
                    Send Back for Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-neutral-800">{value}</p>
    </div>
  );
}
