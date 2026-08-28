"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { isNiftEmail, NIFT_EMAIL_DOMAIN } from "@/lib/validation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { Department, EventSettings } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { Ban } from "lucide-react";

export default function ApplyPage() {
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
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
    (async () => {
      try {
        const [deptSnap, settingsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "departments"),
              where("active", "==", true),
              where("applicationsOpen", "==", true)
            )
          ),
          getDoc(doc(db, "settings", "event")),
        ]);
        setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
        setSettings(settingsSnap.exists() ? (settingsSnap.data() as EventSettings) : null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load the application form");
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isNiftEmail(form.email)) {
      toast.error(`Only ${NIFT_EMAIL_DOMAIN} email addresses can apply`);
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(cred.user, { displayName: form.name });
      await sendEmailVerification(cred.user);
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: form.email,
        name: form.name,
        role: "applicant",
        departmentId: null,
        tedxId: null,
        status: "active",
        createdAt: Date.now(),
      });
      const appRef = await addDoc(collection(db, "applications"), {
        applicantUserId: cred.user.uid,
        name: form.name,
        email: form.email,
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
      await logActivity({
        actorId: cred.user.uid,
        actorName: form.name,
        action: "APPLICATION_SUBMITTED",
        targetType: "application",
        targetId: appRef.id,
        message: `${form.name} submitted an application for ${form.departmentPreference}`,
      });
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message.replace("Firebase: ", ""));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingData) return <FullPageSpinner />;

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
              Thank you, {form.name}. Your application has been received. You can track its
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
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#EB0028] text-sm font-bold text-white">
            TX
          </div>
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
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Full Name" required>
                  <Input required value={form.name} onChange={(e) => update("name", e.target.value)} />
                </FormField>
                <FormField label="Phone" required>
                  <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </FormField>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Email" required hint={`Must end in ${NIFT_EMAIL_DOMAIN} — you'll use this to sign in and check status`}>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </FormField>
                <FormField label="Create Password" required hint="Minimum 6 characters">
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                </FormField>
              </div>

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
