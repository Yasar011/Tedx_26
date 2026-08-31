"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Application, Department } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { sendApplicantEmail, applicantEmails } from "@/lib/email";
import { Users, Search } from "lucide-react";
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
    const result = await sendApplicantEmail({ to, ...content });
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

  const filtered = applications.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Search by name"
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
    </div>
  );
}
