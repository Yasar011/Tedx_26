"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Application, Interview } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const appSnap = await getDoc(doc(db, "applications", id));
      if (appSnap.exists()) setApplication({ id: appSnap.id, ...appSnap.data() } as Application);
      const ivSnap = await getDocs(query(collection(db, "interviews"), where("applicationId", "==", id)));
      if (!ivSnap.empty) setInterview({ id: ivSnap.docs[0].id, ...ivSnap.docs[0].data() } as Interview);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <FullPageSpinner />;
  if (!application) return <p className="text-sm text-neutral-500">Application not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/applications" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" /> Back to applications
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
                className="h-32 w-26 rounded-lg border border-neutral-200 object-cover"
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

        {/* Uses the browser's own print-to-PDF rather than bundling a PDF
            library — the print stylesheet below strips the app chrome. */}
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          <Download className="h-4 w-4" /> Download PDF
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Application Details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Programme" value={`${application.programme} · Sem ${application.semester}`} />
          <Field label="Applied On" value={formatDate(application.createdAt)} />
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
          <Field label="Availability" value={application.availability} />
          <Field label="Portfolio" value={application.portfolio || "—"} />
          <div className="sm:col-span-2">
            <Field label="Skills" value={application.skills} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Experience" value={application.experience || "—"} />
          </div>
          <div className="sm:col-span-2">
            <Field label="Why TEDx?" value={application.why} />
          </div>
          {application.reviewedByName && (
            <Field label="Reviewed By" value={application.reviewedByName} />
          )}
        </CardContent>
      </Card>

      {interview && (
        <Card>
          <CardHeader><CardTitle>Interview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Interviewer" value={interview.interviewerName} />
            {interview.ratings && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(interview.ratings).map(([k, v]) => (
                  <span key={k} className="rounded bg-neutral-100 px-2 py-1 text-xs">{k}: {v}/5</span>
                ))}
              </div>
            )}
            <Field label="Notes" value={interview.notes || "—"} />
            <Field label="Recommendation" value={interview.recommendation || "—"} />
            {interview.coreDecision && (
              <Field
                label="Core Decision"
                value={`${interview.coreDecision.decision} by ${interview.coreDecision.decidedByName} on ${formatDateTime(interview.coreDecision.decidedAt)}${interview.coreDecision.comment ? ` — "${interview.coreDecision.comment}"` : ""}`}
              />
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
