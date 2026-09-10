"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, Department, Interview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { DepartmentAgreementModal } from "@/components/apply/DepartmentAgreementModal";
import { toast } from "sonner";
import { notify } from "@/lib/notifications";

const PIPELINE: Application["status"][] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "CORE_REVIEW",
  "APPROVED",
];

export default function ApplicantPage() {
  const { profile } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<
    "accept" | "decline" | "accept-interview" | "decline-interview" | "move" | null
  >(null);
  // The department an Admin has proposed, loaded so its brief can be shown —
  // agreeing to a move they can't read anything about would be meaningless.
  const [offered, setOffered] = useState<Department | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "applications"), where("applicantUserId", "==", profile.uid))
      );
      if (!snap.empty) {
        const app = { id: snap.docs[0].id, ...snap.docs[0].data() } as Application;
        setApplication(app);

        // Pull the scheduled time so they can see when their interview is
        // without waiting on the email. Only the time is shown — never the
        // ratings or the interviewer's recommendation.
        try {
          const ivSnap = await getDocs(
            query(collection(db, "interviews"), where("applicationId", "==", app.id))
          );
          const interviews = ivSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Interview))
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          if (interviews.length > 0) setInterview(interviews[0]);
        } catch {
          /* non-fatal: the status pipeline still renders */
        }

        if (app.status === "DEPARTMENT_CHANGE_OFFERED" && app.offeredDepartment) {
          try {
            const dSnap = await getDocs(
              query(collection(db, "departments"), where("name", "==", app.offeredDepartment))
            );
            if (!dSnap.empty) {
              setOffered({ id: dSnap.docs[0].id, ...dSnap.docs[0].data() } as Department);
            }
          } catch {
            /* the offer is still answerable without the brief */
          }
        }
      }
      setLoading(false);
    })();
  }, [profile]);

  /**
   * The applicant's own answer to a second-choice offer.
   *
   * Accepting rewrites departmentPreference to their second choice and puts
   * the application back to SUBMITTED, so the new department picks it up as
   * a fresh one. movedToSecond makes any later rejection terminal, so this
   * can't loop. Security rules permit only this exact transition.
   */
  async function respondToSecond(accept: boolean) {
    if (!application) return;
    setDeciding(accept ? "accept" : "decline");
    try {
      if (accept) {
        await updateDoc(doc(db, "applications", application.id), {
          departmentPreference: application.departmentPreference2,
          departmentPreference2: "",
          movedToSecond: true,
          status: "SUBMITTED",
          updatedAt: Date.now(),
        });
        toast.success(`Moved to ${application.departmentPreference2}`);
      } else {
        await updateDoc(doc(db, "applications", application.id), {
          status: "WITHDRAWN",
          updatedAt: Date.now(),
        });
        toast.success("Application withdrawn");
      }
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your application");
      setDeciding(null);
    }
  }

  /**
   * The applicant's answer to a proposed department change.
   *
   * Accepting is what actually moves them: their department becomes the one
   * that was offered and the application goes back to SUBMITTED, so the new
   * team picks it up as a fresh one. Declining restores the status they held
   * before the offer, so considering it costs them nothing. Security rules
   * permit only these two transitions.
   */
  async function respondToMove(accept: boolean) {
    if (!application) return;
    setDeciding(accept ? "move" : "decline");
    try {
      if (accept) {
        await updateDoc(doc(db, "applications", application.id), {
          departmentPreference: application.offeredDepartment,
          offeredDepartment: null,
          statusBeforeOffer: null,
          status: "SUBMITTED",
          agreedToDepartment1: true,
          agreedAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success(`Moved to ${application.offeredDepartment}`);
      } else {
        await updateDoc(doc(db, "applications", application.id), {
          offeredDepartment: null,
          statusBeforeOffer: null,
          status: application.statusBeforeOffer ?? "SUBMITTED",
          updatedAt: Date.now(),
        });
        toast.success(`Staying with ${application.departmentPreference}`);
      }
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your answer");
      setDeciding(null);
    }
  }

  /**
   * The applicant confirming or declining their interview slot.
   *
   * Declining withdraws the application outright — an interview nobody has
   * confirmed shouldn't sit on a Head's calendar. The interviewer is
   * notified in-app rather than by email, because the mail relay only
   * accepts staff roles (which is what keeps the daily quota safe).
   */
  async function respondToInterview(accept: boolean) {
    if (!application || !interview) return;
    setDeciding(accept ? "accept-interview" : "decline-interview");
    try {
      await updateDoc(doc(db, "interviews", interview.id), {
        applicantAccepted: accept,
        applicantRespondedAt: Date.now(),
      });

      if (!accept) {
        await updateDoc(doc(db, "applications", application.id), {
          status: "WITHDRAWN",
          updatedAt: Date.now(),
        });
      }

      await notify({
        userId: interview.interviewerUserId,
        title: accept ? "Interview confirmed" : "Interview declined",
        message: accept
          ? `${application.name} confirmed their interview.`
          : `${application.name} can't make their interview and has withdrawn.`,
        type: "INTERVIEW_RESPONSE",
        relatedId: application.id,
        link: `/department/applicants/${application.id}`,
      }).catch(() => {});

      toast.success(accept ? "Interview confirmed" : "Application withdrawn");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your response");
      setDeciding(null);
    }
  }

  if (loading) return <FullPageSpinner />;

  if (!application) {
    // Being an applicant with no application on file is the normal state of
    // someone who has just been given the role, or who signed up and never
    // finished. Previously this page simply said nothing was found and left
    // them there, with no route to the form at all.
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <EmptyState
          icon={FileText}
          title="You haven't applied yet"
          description="There's no application linked to your account. Fill in the form and you'll be able to track its progress here."
        />
        <Link href="/apply">
          <Button className="mt-6">Start my application</Button>
        </Link>
      </div>
    );
  }

  // Statuses where the step-by-step pipeline no longer makes sense to show.
  const isTerminalNegative =
    application.status === "REJECTED" ||
    application.status === "WAITLISTED" ||
    application.status === "WITHDRAWN";
  const currentIndex = PIPELINE.indexOf(application.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Welcome, {application.name}</h1>
        <p className="text-sm text-neutral-500">Track your TEDxNIFT Jodhpur application status below.</p>
      </div>

      {application.status === "DEPARTMENT_CHANGE_OFFERED" && application.offeredDepartment && (
        <Card className="border-sky-300 bg-sky-50/60">
          <CardContent className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              A different team for you?
            </p>
            <p className="mt-2 text-sm text-neutral-800">
              The organising team would like to move your application from{" "}
              <strong>{application.departmentPreference}</strong> to{" "}
              <strong>{application.offeredDepartment}</strong>.
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Nothing has changed yet. Read what {application.offeredDepartment} does before you
              decide — if you&apos;d rather stay where you are, decline and your application
              carries on exactly as it was.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                loading={deciding === "move"}
                onClick={() => (offered ? setBriefOpen(true) : respondToMove(true))}
              >
                {offered
                  ? `Read the brief & move to ${application.offeredDepartment}`
                  : `Move to ${application.offeredDepartment}`}
              </Button>
              <Button
                variant="outline"
                loading={deciding === "decline"}
                onClick={() => respondToMove(false)}
              >
                Stay with {application.departmentPreference}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DepartmentAgreementModal
        open={briefOpen}
        department={offered}
        preferenceLabel="Proposed department"
        onAgree={() => {
          setBriefOpen(false);
          respondToMove(true);
        }}
        onCancel={() => setBriefOpen(false)}
      />

      {application.status === "SECOND_PREFERENCE_OFFERED" && (
        <Card className="border-orange-300 bg-orange-50/60">
          <CardContent className="py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              Your second choice
            </p>
            <p className="mt-2 text-sm text-neutral-800">
              The <strong>{application.rejectedByDepartment ?? "first"}</strong> team
              wasn&apos;t able to take your application forward. You listed{" "}
              <strong>{application.departmentPreference2}</strong> as your second preference —
              shall we send your application to them?
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              They&apos;ll review it and decide themselves, so this isn&apos;t a guaranteed
              place — it puts you back in the running with that team.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button loading={deciding === "accept"} onClick={() => respondToSecond(true)}>
                Continue with {application.departmentPreference2}
              </Button>
              <Button
                variant="outline"
                loading={deciding === "decline"}
                onClick={() => respondToSecond(false)}
              >
                No thanks, withdraw
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {interview?.scheduledAt && !isTerminalNegative && (
        <Card className="border-[#EB0028]/30 bg-red-50/40">
          <CardContent className="py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#EB0028]">
              Your interview
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {formatDateTime(interview.scheduledAt)}
            </p>

            {interview.applicantAccepted === true ? (
              <p className="mt-2 text-sm text-emerald-700">
                ✓ You&apos;ve confirmed you&apos;ll attend. Please be a few minutes early.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-neutral-700">
                  Please confirm you can make it — interviews aren&apos;t held for applicants
                  who haven&apos;t confirmed.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    loading={deciding === "accept-interview"}
                    onClick={() => respondToInterview(true)}
                  >
                    I&apos;ll be there
                  </Button>
                  <Button
                    variant="outline"
                    loading={deciding === "decline-interview"}
                    onClick={() => respondToInterview(false)}
                  >
                    I can&apos;t make it
                  </Button>
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  Declining withdraws your application.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Application Status</CardTitle>
          <Badge className={APPLICATION_STATUS_COLORS[application.status]}>
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </CardHeader>
        <CardContent>
          {!isTerminalNegative ? (
            <ol className="space-y-3">
              {PIPELINE.map((step, idx) => (
                <li key={step} className="flex items-center gap-3 text-sm">
                  <CheckCircle2
                    className={`h-4 w-4 ${idx <= currentIndex ? "text-emerald-500" : "text-neutral-300"}`}
                  />
                  <span className={idx <= currentIndex ? "text-neutral-900" : "text-neutral-400"}>
                    {APPLICATION_STATUS_LABELS[step]}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-600">
              Your application has been marked as{" "}
              <span className="font-medium">{APPLICATION_STATUS_LABELS[application.status]}</span>.
              Thank you for your interest in TEDxNIFT Jodhpur.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Application</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" value={application.email} />
          <Field label="Phone" value={application.phone} />
          <Field label="Programme" value={application.programme} />
          <Field label="Semester" value={application.semester} />
          <Field label="Department Preference" value={application.departmentPreference} />
          <Field label="Second Preference" value={application.departmentPreference2 || "—"} />
          <Field label="Submitted On" value={formatDate(application.createdAt)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-sm text-neutral-800">{value}</p>
    </div>
  );
}
