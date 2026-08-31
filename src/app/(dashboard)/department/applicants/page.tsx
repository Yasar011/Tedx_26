"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, Department } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Select, FormField, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { sendApplicantEmail, applicantEmails, senderTitleFor } from "@/lib/email";
import { Users, Search, CalendarClock } from "lucide-react";
import { addDoc } from "firebase/firestore";
import { BulkScheduleModal } from "@/components/apply/BulkScheduleModal";
import { Slot } from "@/lib/slots";
import { toast } from "sonner";

export default function DepartmentApplicantsPage() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState<Department | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const canBrowseAll = profile?.role === "admin" || profile?.role === "core";
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Rejection is confirmed rather than one-click: it emails the applicant
  // and is not something to trigger by mis-tapping on a phone.
  const [pendingDecision, setPendingDecision] = useState<{
    app: Application;
    outcome: "REJECTED" | "WAITLISTED";
  } | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());

  async function load() {
    if (!profile) return;

    // Admin/Core can review any department's applicants; everyone else is
    // scoped to their own.
    if (canBrowseAll && allDepartments.length === 0) {
      const snap = await getDocs(collection(db, "departments"));
      const depts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department));
      setAllDepartments(depts);
      if (!selectedId) {
        setSelectedId(profile.departmentId ?? depts[0]?.id ?? null);
        return; // re-runs with the selection applied
      }
    }

    const targetId = canBrowseAll ? selectedId : profile.departmentId;
    if (!targetId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const deptSnap = await getDoc(doc(db, "departments", targetId));
    const dept = deptSnap.exists() ? ({ id: deptSnap.id, ...deptSnap.data() } as Department) : null;
    setDepartment(dept);
    if (dept) {
      const snap = await getDocs(
        query(collection(db, "applications"), where("departmentPreference", "==", dept.name))
      );
      setApplications(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Application))
          .sort((a, b) => b.createdAt - a.createdAt)
      );

      // Anyone already holding an interview is excluded from bulk
      // scheduling, so re-running it can't double-book them.
      const ivSnap = await getDocs(
        query(collection(db, "interviews"), where("departmentId", "==", targetId))
      );
      setScheduledIds(
        new Set(ivSnap.docs.map((d) => (d.data() as { applicationId: string }).applicationId))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, selectedId]);

  async function shortlist(app: Application) {
    await updateDoc(doc(db, "applications", app.id), {
      status: "SHORTLISTED",
      updatedAt: Date.now(),
      reviewedBy: profile!.uid,
      reviewedByName: profile!.name,
    });
    await logActivity({
      actorId: profile!.uid,
      actorName: profile!.name,
      action: "APPLICATION_SHORTLISTED",
      targetType: "application",
      targetId: app.id,
      message: `${app.name} was shortlisted by ${profile!.name}`,
      departmentId: profile!.departmentId,
    });
    toast.success(`${app.name} shortlisted`);

    // Emailed after the status is committed: the applicant is shortlisted
    // whether or not the daily send quota allows a mail right now.
    await notifyApplicant(
      app.email,
      applicantEmails.shortlisted(app.name, app.departmentPreference)
    );
    load();
  }

  /** Sends an applicant email and reports quota problems rather than hiding them. */
  async function notifyApplicant(
    to: string,
    content: { subject: string; heading: string; message: string; detail?: string }
  ) {
    const result = await sendApplicantEmail({
      to,
      ...content,
      senderName: profile?.name,
      senderTitle: senderTitleFor(profile?.role, department?.name),
    });
    if (result.ok) {
      if (typeof result.remaining === "number" && result.remaining <= 10) {
        toast.warning(`Email sent — only ${result.remaining} left in today's quota`);
      }
      return;
    }
    if (result.error === "quota_exhausted") {
      toast.error("Today's 100-email limit is used up — tell this applicant directly.");
    } else {
      toast.error(`Status saved, but the email didn't send: ${result.error ?? "unknown"}`);
    }
  }

  /**
   * Turns an applicant down without an interview.
   *
   * Approve is intentionally NOT available here — only an Admin issues the
   * final decision and the TEDx ID — but rejecting early has to be possible,
   * otherwise an obviously unsuitable applicant has to be marched through a
   * whole interview cycle before they can be declined.
   */
  async function decideEarly(app: Application, outcome: "REJECTED" | "WAITLISTED") {
    setDecidingId(app.id);
    try {
      // A rejection isn't final while the applicant still has an untried
      // second preference — the application is offered to that department
      // instead, and the applicant decides whether to continue. Only once
      // they've already been rolled over (movedToSecond) is it terminal.
      const rollsOverToSecond =
        outcome === "REJECTED" && !!app.departmentPreference2 && !app.movedToSecond;

      const nextStatus = rollsOverToSecond ? "SECOND_PREFERENCE_OFFERED" : outcome;

      await updateDoc(doc(db, "applications", app.id), {
        status: nextStatus,
        rejectedByDepartment: outcome === "REJECTED" ? app.departmentPreference : null,
        updatedAt: Date.now(),
        reviewedBy: profile!.uid,
        reviewedByName: profile!.name,
      });

      await logActivity({
        actorId: profile!.uid,
        actorName: profile!.name,
        action: rollsOverToSecond ? "APPLICATION_OFFERED_SECOND" : `APPLICATION_${outcome}`,
        targetType: "application",
        targetId: app.id,
        message: rollsOverToSecond
          ? `${app.name} was turned down by ${app.departmentPreference} and offered their second choice, ${app.departmentPreference2}`
          : `${app.name} marked ${outcome.toLowerCase()} by ${profile!.name}${
              rejectNote ? `: ${rejectNote}` : ""
            }`,
        departmentId: profile!.departmentId,
      });

      toast.success(
        rollsOverToSecond
          ? `${app.name} offered their second choice (${app.departmentPreference2})`
          : `${app.name} marked ${outcome.toLowerCase()}`
      );

      await notifyApplicant(
        app.email,
        rollsOverToSecond
          ? applicantEmails.secondPreferenceOffered(
              app.name,
              app.departmentPreference,
              app.departmentPreference2
            )
          : outcome === "REJECTED"
          ? applicantEmails.rejected(app.name, app.departmentPreference, rejectNote)
          : applicantEmails.waitlisted(app.name, app.departmentPreference)
      );

      setPendingDecision(null);
      setRejectNote("");
      load();
    } finally {
      setDecidingId(null);
    }
  }

  /**
   * Creates an interview per applicant and emails each their own time.
   *
   * Sends are sequential rather than parallel: a burst of fifty parallel
   * requests risks Gmail throttling, and one-at-a-time lets the progress
   * bar be truthful. A failure on one person doesn't abort the rest —
   * their interview is still created, and the failure is reported at the
   * end so those few can be contacted directly.
   */
  async function runBulkSchedule(slots: Slot[]) {
    if (!profile || !department) return;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: slots.length });
    let emailFailures = 0;

    try {
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        await addDoc(collection(db, "interviews"), {
          applicationId: slot.applicationId,
          departmentId: department.id,
          interviewerUserId: profile.uid,
          interviewerName: profile.name,
          scheduledAt: slot.startsAt,
          applicantAccepted: null,
          applicantRespondedAt: null,
          attended: null,
          notes: "",
          ratings: null,
          recommendation: null,
          submittedAt: null,
          coreDecision: null,
          createdAt: Date.now(),
        });

        await updateDoc(doc(db, "applications", slot.applicationId), {
          status: "INTERVIEW_SCHEDULED",
          updatedAt: Date.now(),
        });

        const mail = await sendApplicantEmail({
          to: slot.email,
          senderName: profile.name,
          senderTitle: senderTitleFor(profile.role, department.name),
          ...applicantEmails.interviewScheduled(slot.name, department.name, slot.startsAt),
        });
        if (!mail.ok) emailFailures++;

        setBulkProgress({ done: i + 1, total: slots.length });
      }

      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "INTERVIEWS_BULK_SCHEDULED",
        targetType: "department",
        targetId: department.id,
        message: `${profile.name} scheduled ${slots.length} interviews for ${department.name}`,
        departmentId: department.id,
      });

      if (emailFailures > 0) {
        toast.error(
          `Scheduled all ${slots.length}, but ${emailFailures} email${emailFailures !== 1 ? "s" : ""} didn't send — contact those applicants directly.`
        );
      } else {
        toast.success(`Scheduled and emailed ${slots.length} interviews`);
      }
      setBulkOpen(false);
      load();
    } finally {
      setBulkRunning(false);
      setBulkProgress(null);
    }
  }

  async function moveToReview(app: Application) {
    await updateDoc(doc(db, "applications", app.id), {
      status: "UNDER_REVIEW",
      updatedAt: Date.now(),
      reviewedBy: profile!.uid,
      reviewedByName: profile!.name,
    });
    load();
  }

  if (loading) return <FullPageSpinner />;
  if (!department) {
    return (
      <EmptyState icon={Users} title="No department assigned" description="Contact an Admin to get assigned to a department." />
    );
  }

  // Shortlisted and not already holding an interview — the people a bulk
  // schedule should actually cover.
  const awaitingSchedule = applications.filter(
    (a) => a.status === "SHORTLISTED" && !scheduledIds.has(a.id)
  );

  const filtered = applications.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Applicants — {department.name}</h1>
          <p className="text-sm text-neutral-500">{applications.length} total applications</p>
        </div>
        <div className="flex items-center gap-2">
          {awaitingSchedule.length > 0 && (
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Schedule {awaitingSchedule.length} interview
              {awaitingSchedule.length !== 1 ? "s" : ""}
            </Button>
          )}
        {canBrowseAll && allDepartments.length > 1 && (
          <Select
            className="w-52"
            value={selectedId ?? ""}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-neutral-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#EB0028]/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-neutral-300 px-3 text-sm"
        >
          <option value="ALL">All statuses</option>
          {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No applicants found" description="No applications match your filters." />
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <Card key={app.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {app.photoUrl ? (
                    // Cloudinary URL — next/image would need the host allow-listed.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={app.photoUrl}
                      alt=""
                      className="h-12 w-10 shrink-0 rounded border border-neutral-200 object-cover"
                    />
                  ) : (
                    <div className="h-12 w-10 shrink-0 rounded border border-dashed border-neutral-200 bg-neutral-50" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">{app.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {app.programme} · Sem {app.semester} · Applied {formatDate(app.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={APPLICATION_STATUS_COLORS[app.status]}>
                    {APPLICATION_STATUS_LABELS[app.status]}
                  </Badge>
                  {/* Always available: a Head needs to read the full
                      application before deciding to shortlist, not after. */}
                  <Link href={`/department/applicants/${app.id}`}>
                    <Button size="sm" variant="ghost">
                      View full
                    </Button>
                  </Link>
                  {app.status === "SUBMITTED" && (
                    <Button size="sm" variant="outline" onClick={() => moveToReview(app)}>
                      Start Review
                    </Button>
                  )}
                  {(app.status === "UNDER_REVIEW" || app.status === "SUBMITTED") && (
                    <Button size="sm" onClick={() => shortlist(app)}>
                      Shortlist
                    </Button>
                  )}

                  {/* Available up to the point Core/Admin take over the
                      decision, so a Head isn't forced to interview someone
                      just to decline them. */}
                  {["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(
                    app.status
                  ) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingDecision({ app, outcome: "WAITLISTED" })}
                      >
                        Waitlist
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPendingDecision({ app, outcome: "REJECTED" })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {(app.status === "SHORTLISTED" ||
                    app.status === "INTERVIEW_SCHEDULED" ||
                    app.status === "INTERVIEW_COMPLETED" ||
                    app.status === "CORE_REVIEW" ||
                    app.status === "APPROVED" ||
                    app.status === "REJECTED" ||
                    app.status === "WAITLISTED") && (
                    <Link href={`/department/applicants/${app.id}`}>
                      <Button size="sm" variant="outline">
                        {app.status === "SHORTLISTED" ? "Interview" : "View"}
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BulkScheduleModal
        open={bulkOpen}
        applicants={awaitingSchedule}
        onClose={() => setBulkOpen(false)}
        onConfirm={runBulkSchedule}
        progress={bulkProgress}
        running={bulkRunning}
      />

      <Modal
        open={!!pendingDecision}
        onClose={() => {
          setPendingDecision(null);
          setRejectNote("");
        }}
        title={
          pendingDecision?.outcome === "REJECTED"
            ? `Reject ${pendingDecision.app.name}?`
            : `Waitlist ${pendingDecision?.app.name}?`
        }
      >
        {(() => {
          if (pendingDecision?.outcome === "WAITLISTED") {
            return (
              <p className="text-sm text-neutral-600">
                They&apos;ll be told they&apos;re on the waitlist, by email.
              </p>
            );
          }
          const rollsOver =
            !!pendingDecision?.app.departmentPreference2 && !pendingDecision?.app.movedToSecond;
          return rollsOver ? (
            <p className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
              They listed <strong>{pendingDecision?.app.departmentPreference2}</strong> as their
              second choice, so this won&apos;t reject them outright — they&apos;ll be emailed and
              asked whether they want to continue with that team. If they decline, the
              application is withdrawn.
            </p>
          ) : (
            <p className="text-sm text-neutral-600">
              {pendingDecision?.app.movedToSecond
                ? "This was already their second choice, so rejecting is final."
                : "They listed no second preference, so rejecting is final."}{" "}
              They&apos;ll be told by email.
            </p>
          );
        })()}

        {pendingDecision?.outcome === "REJECTED" && (
          <div className="mt-4">
            <FormField
              label="Feedback (optional)"
              hint="Included in the email. A line of genuine feedback goes a long way."
            >
              <Textarea
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </FormField>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setPendingDecision(null);
              setRejectNote("");
            }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant={pendingDecision?.outcome === "REJECTED" ? "danger" : "primary"}
            loading={decidingId === pendingDecision?.app.id}
            onClick={() =>
              pendingDecision && decideEarly(pendingDecision.app, pendingDecision.outcome)
            }
          >
            {pendingDecision?.outcome === "REJECTED" ? "Reject" : "Waitlist"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
