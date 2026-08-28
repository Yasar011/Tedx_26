"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { FileText, CheckCircle2 } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const snap = await getDocs(
        query(collection(db, "applications"), where("applicantUserId", "==", profile.uid))
      );
      if (!snap.empty) {
        setApplication({ id: snap.docs[0].id, ...snap.docs[0].data() } as Application);
      }
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <FullPageSpinner />;

  if (!application) {
    return (
      <EmptyState
        icon={FileText}
        title="No application found"
        description="We couldn't find an application linked to your account."
      />
    );
  }

  const isTerminalNegative = application.status === "REJECTED" || application.status === "WAITLISTED";
  const currentIndex = PIPELINE.indexOf(application.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Welcome, {application.name}</h1>
        <p className="text-sm text-neutral-500">Track your TEDxNIFT Jodhpur application status below.</p>
      </div>

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
