"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getCountFromServer,
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
import { sendApplicantEmail, applicantEmails, getEmailQuota } from "@/lib/email";
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
  const [pendingFiles, setPendingFiles] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const isAdmin = profile?.role === "admin";

  // Sending is capped per day by Gmail, so show what's left before someone
  // works through a batch and silently runs out partway.
  useEffect(() => {
    getEmailQuota().then(setQuota);
  }, []);

  async function load() {
    try {
      // Interviews are fetched once and joined in memory. Previously this
      // ran a separate query per pending application, in a second wave that
      // only started after the batch below resolved.
      const [appSnap, deptSnap, interviewSnap, pendingFilesCount, pendingTasksCount] =
        await Promise.all([
          getDocs(query(collection(db, "applications"), where("status", "==", "CORE_REVIEW"))),
          getDocs(collection(db, "departments")),
          getDocs(collection(db, "interviews")),
          getCountFromServer(query(collection(db, "files"), where("approvalStatus", "==", "PENDING"))),
          getCountFromServer(query(collection(db, "tasks"), where("status", "==", "SUBMITTED_FOR_REVIEW"))),
        ]);

      setPendingFiles(pendingFilesCount.data().count);
      setPendingTasks(pendingTasksCount.data().count);
      setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));

      const interviewByAppId = new Map<string, Interview>();
      interviewSnap.docs.forEach((d) => {
        const interview = { id: d.id, ...d.data() } as Interview;
        // Keep the most recent interview if an applicant somehow has more.
        const existing = interviewByAppId.get(interview.applicationId);
        if (!existing || (interview.createdAt ?? 0) > (existing.createdAt ?? 0)) {
          interviewByAppId.set(interview.applicationId, interview);
        }
      });

      const rowsData: Row[] = appSnap.docs.map((d) => {
        const application = { id: d.id, ...d.data() } as Application;
        return { application, interview: interviewByAppId.get(application.id) ?? null };
      });

      setRows(rowsData.sort((a, b) => b.application.updatedAt - a.application.updatedAt));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load approvals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  /** Sends an applicant email; a quota failure must never hide the decision. */
  async function notifyApplicant(
    to: string,
    content: { subject: string; heading: string; message: string; detail?: string }
  ) {
    const result = await sendApplicantEmail({ to, ...content });
    if (result.ok) {
      if (typeof result.remaining === "number") setQuota(result.remaining);
      return;
    }
    toast.error(
      result.error === "quota_exhausted"
        ? "Decision saved, but today's email limit is used up — contact them directly."
        : `Decision saved, but the email didn't send: ${result.error ?? "unknown"}`
    );
  }

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
        await notifyApplicant(
          row.application.email,
          applicantEmails.approved(row.application.name, dept.name, tedxId)
        );
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

        // "Sent back" is an internal step — the applicant sees no change,
        // so emailing them about it would only confuse.
        if (decision === "REJECTED") {
          await notifyApplicant(
            row.application.email,
            applicantEmails.rejected(
              row.application.name,
              row.application.departmentPreference,
              comment
            )
          );
        } else if (decision === "WAITLISTED") {
          await notifyApplicant(
            row.application.email,
            applicantEmails.waitlisted(
              row.application.name,
              row.application.departmentPreference
            )
          );
        }
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

  if (loadError) {
    return <EmptyState icon={CheckSquare} title="Couldn't load approvals" description={loadError} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Approval Center</h1>
        <p className="text-sm text-neutral-500">Everything currently waiting on a Core/Admin decision.</p>
        {quota !== null && (
          <p
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
              quota <= 10
                ? "bg-red-100 text-red-700"
                : quota <= 30
                ? "bg-amber-100 text-amber-700"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            {quota} applicant emails left today
            {quota <= 10 && " — decisions still save, but tell people directly"}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-medium uppercase text-neutral-400">Volunteer Applications</p>
            <p className="text-2xl font-bold text-neutral-900">{rows.length}</p>
          </CardContent>
        </Card>
        <Link href="/files">
          <Card className="hover:border-neutral-300">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-neutral-400">Pending Files</p>
              <p className="text-2xl font-bold text-neutral-900">{pendingFiles}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/tasks">
          <Card className="hover:border-neutral-300">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase text-neutral-400">Tasks Submitted for Review</p>
              <p className="text-2xl font-bold text-neutral-900">{pendingTasks}</p>
            </CardContent>
          </Card>
        </Link>
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
                <div className="flex gap-4">
                  {row.application.photoUrl && (
                    <a
                      href={row.application.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title="Open full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.application.photoUrl}
                        alt={row.application.name}
                        className="h-28 w-24 rounded-lg border border-neutral-200 object-cover"
                      />
                    </a>
                  )}
                  <div className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
                    <Field label="Email" value={row.application.email} />
                    <Field label="Phone" value={row.application.phone} />
                    <Field label="Programme" value={row.application.programme} />
                    <Field label="Why TEDx?" value={row.application.why} />
                  </div>
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
                  {/* Final approval issues the TEDx Member ID and activates
                      the account, so it is reserved for Admin. Core can still
                      reject, waitlist or send back for another look. */}
                  {isAdmin ? (
                    <Button
                      loading={busyId === row.application.id}
                      onClick={() => decide(row, "APPROVED")}
                    >
                      Approve &amp; issue TEDx ID
                    </Button>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
                      Final approval and TEDx ID are issued by an Admin
                    </span>
                  )}
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
