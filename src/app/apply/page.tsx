"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isNiftEmail, NIFT_EMAIL_DOMAIN } from "@/lib/validation";
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
import { Department, EventSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Logo } from "@/components/ui/Logo";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { Ban } from "lucide-react";

export default function ApplyPage() {
  const { firebaseUser, profile, loading: authLoading } = useAuth();
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    phone: "",
    programme: "",
    semester: "",
    departmentPreference: "",
    departmentPreference2: "",
    skills: "",
    experience: "",
    portfolio: "",
    why: "",
    availability: "",
  });

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      try {
        const [deptSnap, settingsSnap, existingSnap] = await Promise.all([
          // Single-field query + in-memory filter: two where() clauses would
          // need a composite index, and this must work without any index
          // deployment.
          getDocs(query(collection(db, "departments"), where("active", "==", true))),
          getDoc(doc(db, "settings", "event")),
          getDocs(
            query(collection(db, "applications"), where("applicantUserId", "==", firebaseUser.uid))
          ),
        ]);
        setDepartments(
          deptSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Department))
            .filter((d) => d.applicationsOpen !== false)
        );
        setSettings(settingsSnap.exists() ? (settingsSnap.data() as EventSettings) : null);
        setAlreadyApplied(!existingSnap.empty);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load the application form");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [firebaseUser]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    if (!isNiftEmail(profile.email)) {
      toast.error(`Only ${NIFT_EMAIL_DOMAIN} email addresses can apply`);
      return;
    }
    setSubmitting(true);
    try {
      const appRef = await addDoc(collection(db, "applications"), {
        applicantUserId: firebaseUser.uid,
        name: profile.name,
        email: profile.email,
        phone: form.phone,
        programme: form.programme,
        semester: form.semester,
        departmentPreference: form.departmentPreference,
        departmentPreference2: form.departmentPreference2,
        skills: form.skills,
        experience: form.experience,
        portfolio: form.portfolio,
        why: form.why,
        availability: form.availability,
        status: "SUBMITTED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewedBy: null,
        reviewedByName: null,
      });
      // Move the account from "unassigned" to "applicant" so it lands on the
      // application-status dashboard from now on. Security rules permit only
      // this specific self-transition — never an elevation.
      if (profile.role === "unassigned") {
        await updateDoc(doc(db, "users", firebaseUser.uid), { role: "applicant" });
      }

      await logActivity({
        actorId: firebaseUser.uid,
        actorName: profile.name,
        action: "APPLICATION_SUBMITTED",
        targetType: "application",
        targetId: appRef.id,
        message: `${profile.name} submitted an application for ${form.departmentPreference}`,
      });
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message.replace("Firebase: ", ""));
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <FullPageSpinner />;

  // Applying requires an account, so applicants can sign back in later to
  // track their status. Rendered inline rather than redirected so there's
  // no blank flash and no dependence on router timing.
  if (!firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10">
            <Logo priority className="mx-auto mb-4 h-10 w-auto" />
            <h1 className="text-lg font-semibold text-neutral-900">Sign in to apply</h1>
            <p className="mt-2 text-sm text-neutral-500">
              You need a {NIFT_EMAIL_DOMAIN} account before applying — that&apos;s how you&apos;ll
              track your application status afterwards.
            </p>
            <Link href="/login?next=/apply">
              <Button className="mt-6 w-full">Sign in or create an account</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingData) return <FullPageSpinner />;

  if (alreadyApplied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10">
            <h1 className="text-lg font-semibold text-neutral-900">You&apos;ve already applied</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Your application is on file. You can track its status from your dashboard.
            </p>
            <Button className="mt-6" onClick={() => router.replace("/dashboard")}>
              View my application status
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <EmptyState
          icon={Ban}
          title="Could not load the application form"
          description="Please try again in a moment. If this keeps happening, contact the organizing team."
        />
      </div>
    );
  }

  if (settings && settings.applicationsOpen === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <EmptyState
          icon={Ban}
          title="Applications are currently closed"
          description="TEDxNIFT Jodhpur recruitment is not accepting new applications right now. Please check back later."
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10">
            <h1 className="text-lg font-semibold text-neutral-900">Application submitted!</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Thank you, {profile?.name}. Your application has been received. You can track its
              status from your dashboard.
            </p>
            <Button className="mt-6" onClick={() => router.replace("/dashboard")}>
              Go to my dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <Logo priority className="mx-auto mb-3 h-12 w-auto" />
          <h1 className="text-2xl font-semibold text-neutral-900">
            {settings?.eventName ?? "TEDxNIFT Jodhpur"} Volunteer Application
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Join the organizing team for {settings?.year ?? new Date().getFullYear()}.
          </p>
        </div>

        <Card>
          <CardContent className="py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Applying as
                </p>
                <p className="font-medium text-neutral-900">{profile?.name}</p>
                <p className="text-neutral-500">{profile?.email}</p>
              </div>

              <FormField label="Phone" required>
                <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </FormField>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="NIFT Programme" required>
                  <Input
                    required
                    placeholder="e.g. B.Des Fashion Design"
                    value={form.programme}
                    onChange={(e) => update("programme", e.target.value)}
                  />
                </FormField>
                <FormField label="Semester" required>
                  <Input required value={form.semester} onChange={(e) => update("semester", e.target.value)} />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Department Preference" required>
                  <Select
                    required
                    value={form.departmentPreference}
                    onChange={(e) => update("departmentPreference", e.target.value)}
                  >
                    <option value="">Select a department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Second Preference">
                  <Select
                    value={form.departmentPreference2}
                    onChange={(e) => update("departmentPreference2", e.target.value)}
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <DepartmentInfoPanel departments={departments} />

              <FormField label="Relevant Skills" required>
                <Textarea
                  required
                  rows={2}
                  value={form.skills}
                  onChange={(e) => update("skills", e.target.value)}
                />
              </FormField>

              <FormField label="Prior Experience">
                <Textarea
                  rows={2}
                  value={form.experience}
                  onChange={(e) => update("experience", e.target.value)}
                />
              </FormField>

              <FormField label="Portfolio / Links" hint="Google Drive, Behance, Instagram, GitHub, etc.">
                <Input value={form.portfolio} onChange={(e) => update("portfolio", e.target.value)} />
              </FormField>

              <FormField label="Why do you want to join TEDxNIFT Jodhpur?" required>
                <Textarea
                  required
                  rows={4}
                  value={form.why}
                  onChange={(e) => update("why", e.target.value)}
                />
              </FormField>

              <FormField label="Availability" required hint="Hours per week you can commit">
                <Input
                  required
                  value={form.availability}
                  onChange={(e) => update("availability", e.target.value)}
                />
              </FormField>

              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DepartmentInfoPanel({ departments }: { departments: Department[] }) {
  const withInfo = departments.filter((d) => d.description || d.purpose || d.responsibilities);
  if (withInfo.length === 0) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        What each department does
      </p>
      <div className="space-y-3">
        {withInfo.map((d) => (
          <div key={d.id} className="text-sm">
            <p className="font-medium text-neutral-900">{d.name}</p>
            {d.description && <p className="text-neutral-600">{d.description}</p>}
            {d.responsibilities && (
              <p className="text-neutral-500">
                <span className="font-medium">Responsibilities: </span>
                {d.responsibilities}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
