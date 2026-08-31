"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, Interview, InterviewRatings, Recommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { sendApplicantEmail, applicantEmails, senderTitleFor } from "@/lib/email";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const RATING_FIELDS: (keyof InterviewRatings)[] = [
  "communication",
  "creativity",
  "teamwork",
  "skills",
  "availability",
  "overall",
];

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [ratings, setRatings] = useState<InterviewRatings>({
    communication: 3,
    creativity: 3,
    teamwork: 3,
    skills: 3,
    availability: 3,
    overall: 3,
  });
  const [recommendation, setRecommendation] = useState<Recommendation>("SELECT");

  async function load() {
    const appSnap = await getDoc(doc(db, "applications", id));
    if (appSnap.exists()) setApplication({ id: appSnap.id, ...appSnap.data() } as Application);

    const interviewSnap = await getDocs(
      query(collection(db, "interviews"), where("applicationId", "==", id))
    );
    if (!interviewSnap.empty) {
      const iv = { id: interviewSnap.docs[0].id, ...interviewSnap.docs[0].data() } as Interview;
      setInterview(iv);
      setNotes(iv.notes ?? "");
      if (iv.ratings) setRatings(iv.ratings);
      if (iv.recommendation) setRecommendation(iv.recommendation);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function scheduleInterview() {
    if (!application || !profile) return;
    setSaving(true);
    try {
      const ts = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
      const ref = await addDoc(collection(db, "interviews"), {
        applicationId: application.id,
        departmentId: profile.departmentId,
        interviewerUserId: profile.uid,
        interviewerName: profile.name,
        scheduledAt: ts,
        notes: "",
        ratings: null,
        recommendation: null,
        submittedAt: null,
        coreDecision: null,
        createdAt: Date.now(),
      });
      await updateDoc(doc(db, "applications", application.id), {
        status: "INTERVIEW_SCHEDULED",
        updatedAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "INTERVIEW_SCHEDULED",
        targetType: "application",
        targetId: application.id,
        message: `Interview scheduled for ${application.name} by ${profile.name}`,
        departmentId: profile.departmentId,
      });
      toast.success("Interview scheduled");

      // The applicant is told the time by email as well as in-app, since
      // they won't necessarily be signed in when it's set.
      const mail = await sendApplicantEmail({
        to: application.email,
        senderName: profile.name,
        senderTitle: senderTitleFor(profile.role, application.departmentPreference),
        ...applicantEmails.interviewScheduled(
          application.name,
          application.departmentPreference,
          ts
        ),
      });
      if (!mail.ok) {
        toast.error(
          mail.error === "quota_exhausted"
            ? "Interview saved, but today's email limit is used up — tell them directly."
            : `Interview saved, but the email didn't send: ${mail.error ?? "unknown"}`
        );
      }
      setInterview({ id: ref.id } as Interview);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function submitRecommendation() {
    if (!application || !profile || !interview) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "interviews", interview.id), {
        notes,
        ratings,
        recommendation,
        submittedAt: Date.now(),
      });
      await updateDoc(doc(db, "applications", application.id), {
        status: "CORE_REVIEW",
        updatedAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "INTERVIEW_SUBMITTED",
        targetType: "application",
        targetId: application.id,
        message: `${profile.name} recommended "${recommendation}" for ${application.name} and sent to Core Team`,
        departmentId: profile.departmentId,
      });
      toast.success("Recommendation submitted to Core Team");
      router.push("/department/applicants");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;
  if (!application) return <p className="text-sm text-neutral-500">Application not found.</p>;

  const readOnly = !!interview?.submittedAt;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/department/applicants" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" /> Back to applicants
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          {application.photoUrl && (
            <a href={application.photoUrl} target="_blank" rel="noreferrer" title="Open full size">
              {/* Cloudinary URL — next/image would need the host allow-listed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={application.photoUrl}
                alt={application.name}
                className="h-32 rounded-lg border border-neutral-200 object-cover"
                style={{ width: "6.5rem" }}
              />
            </a>
          )}
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{application.name}</h1>
            <p className="text-sm text-neutral-500">{application.email}</p>
            <p className="text-sm text-neutral-500">{application.phone}</p>
            <Badge className={`mt-2 ${APPLICATION_STATUS_COLORS[application.status]}`}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          Download PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Answers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field label="Programme" value={`${application.programme} · Semester ${application.semester}`} />
          <Field
            label="First Preference"
            value={`${application.departmentPreference}${
              application.agreedToDepartment1 ? "  ✓ agreed" : ""
            }`}
          />
          <Field
            label="Second Preference"
            value={
              application.departmentPreference2
                ? `${application.departmentPreference2}${
                    application.agreedToDepartment2 ? "  ✓ agreed" : ""
                  }`
                : "—"
            }
          />
          <Field label="Skills" value={application.skills} />
          <Field label="Experience" value={application.experience || "—"} />
          <Field label="Portfolio" value={application.portfolio || "—"} />
          <Field label="Why TEDx?" value={application.why} />
          <Field label="Availability" value={application.availability} />
        </CardContent>
      </Card>

      {!interview && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Interview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Date & time">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </FormField>
            <Button onClick={scheduleInterview} loading={saving}>
              Schedule Interview
            </Button>
          </CardContent>
        </Card>
      )}

      {interview && (
        <Card>
          <CardHeader>
            <CardTitle>Interview Evaluation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {interview.scheduledAt && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs text-neutral-500">
                  Scheduled for {formatDateTime(interview.scheduledAt)}
                </p>
                {/* Whether the applicant actually confirmed — an unconfirmed
                    slot shouldn't be held. */}
                <p className="mt-1 text-sm font-medium">
                  {interview.applicantAccepted === true ? (
                    <span className="text-emerald-700">✓ Applicant confirmed they&apos;ll attend</span>
                  ) : interview.applicantAccepted === false ? (
                    <span className="text-red-700">✕ Applicant declined — application withdrawn</span>
                  ) : (
                    <span className="text-amber-700">Awaiting the applicant&apos;s confirmation</span>
                  )}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {RATING_FIELDS.map((field) => (
                <FormField key={field} label={field.charAt(0).toUpperCase() + field.slice(1)}>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    disabled={readOnly}
                    value={ratings[field]}
                    onChange={(e) =>
                      setRatings((r) => ({ ...r, [field]: Number(e.target.value) }))
                    }
                  />
                </FormField>
              ))}
            </div>
            <FormField label="Interview Notes">
              <Textarea
                rows={4}
                disabled={readOnly}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>
            <FormField label="Recommendation">
              <Select
                disabled={readOnly}
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as Recommendation)}
              >
                <option value="SELECT">Select</option>
                <option value="WAITLIST">Waitlist</option>
                <option value="REJECT">Reject</option>
              </Select>
            </FormField>
            {!readOnly ? (
              <Button onClick={submitRecommendation} loading={saving}>
                Submit to Core Organizing Team
              </Button>
            ) : (
              <p className="text-sm text-emerald-600">
                Recommendation submitted on {formatDateTime(interview.submittedAt)}.
              </p>
            )}
          </CardContent>
        </Card>
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
