"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isNiftEmail, NIFT_EMAIL_DOMAIN } from "@/lib/validation";
import { ROLE_LABELS } from "@/lib/constants";
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
import { Ban, Check, Image as ImageIcon, X } from "lucide-react";
import {
  compressImage,
  MAX_CERTIFICATE_BYTES,
  CERTIFICATE_EDGE_PX,
} from "@/lib/imageCompress";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { DepartmentAgreementModal } from "@/components/apply/DepartmentAgreementModal";
import { VerifyEmailScreen } from "@/components/auth/VerifyEmailScreen";

/** At most two certificates, as agreed with the organising team. */
const MAX_CERTIFICATES = 2;

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

  // Passport photo, compressed in the browser before upload.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Optional supporting certificates. Capped at two so review stays quick
  // and a single applicant can't push a lot of weight into storage.
  const [certificates, setCertificates] = useState<{ file: File; preview: string }[]>([]);
  const [certBusy, setCertBusy] = useState(false);

  // A department only counts as chosen once its brief has been accepted, so
  // the pending selection is held here until the applicant agrees.
  const [agreed1, setAgreed1] = useState(false);
  const [agreed2, setAgreed2] = useState(false);
  const [pending, setPending] = useState<{ slot: 1 | 2; department: Department } | null>(null);

  async function handlePhotoPick(file: File) {
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      setPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev.preview);
        return { file: compressed, preview: URL.createObjectURL(compressed) };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process that image");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleCertificatePick(file: File) {
    if (certificates.length >= MAX_CERTIFICATES) {
      toast.error(`You can attach at most ${MAX_CERTIFICATES} certificates`);
      return;
    }
    setCertBusy(true);
    try {
      // Squeezed harder than the photo, and from a larger starting edge so
      // the text on a certificate stays readable at 200 KB.
      const compressed = await compressImage(
        file,
        MAX_CERTIFICATE_BYTES,
        CERTIFICATE_EDGE_PX
      );
      setCertificates((prev) => [
        ...prev,
        { file: compressed, preview: URL.createObjectURL(compressed) },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process that certificate");
    } finally {
      setCertBusy(false);
    }
  }

  function removeCertificate(index: number) {
    setCertificates((prev) => {
      const next = [...prev];
      const [gone] = next.splice(index, 1);
      if (gone) URL.revokeObjectURL(gone.preview);
      return next;
    });
  }

  /** Opens the brief for a selection; nothing is committed until they agree. */
  function requestDepartment(slot: 1 | 2, name: string) {
    if (!name) {
      if (slot === 1) {
        setForm((f) => ({ ...f, departmentPreference: "" }));
        setAgreed1(false);
      } else {
        setForm((f) => ({ ...f, departmentPreference2: "" }));
        setAgreed2(false);
      }
      return;
    }
    const department = departments.find((d) => d.name === name);
    if (!department) return;
    setPending({ slot, department });
  }

  function confirmDepartment() {
    if (!pending) return;
    const { slot, department } = pending;
    if (slot === 1) {
      setForm((f) => ({
        ...f,
        departmentPreference: department.name,
        // Clear a second choice that now duplicates the first.
        departmentPreference2:
          f.departmentPreference2 === department.name ? "" : f.departmentPreference2,
      }));
      setAgreed1(true);
      if (form.departmentPreference2 === department.name) setAgreed2(false);
    } else {
      setForm((f) => ({ ...f, departmentPreference2: department.name }));
      setAgreed2(true);
    }
    setPending(null);
  }

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
    if (!photo) {
      toast.error("Please add a passport-size photo");
      return;
    }
    if (!agreed1) {
      toast.error("Please review and accept your first-preference department");
      return;
    }
    if (form.departmentPreference2 && !agreed2) {
      toast.error("Please review and accept your second-preference department");
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadToCloudinary(photo.file, "TEDxNIFT/applicants");

      // Uploaded after the photo so a certificate failure can't cost the
      // applicant their whole submission silently — it throws and is caught
      // by the same handler, with nothing written to Firestore yet.
      const uploadedCertificates = [];
      for (const cert of certificates) {
        const res = await uploadToCloudinary(cert.file, "TEDxNIFT/certificates");
        uploadedCertificates.push({
          url: res.url,
          publicId: res.publicId,
          name: cert.file.name,
        });
      }

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
        photoUrl: uploaded.url,
        photoPublicId: uploaded.publicId,
        certificates: uploadedCertificates,
        agreedToDepartment1: agreed1,
        agreedToDepartment2: form.departmentPreference2 ? agreed2 : false,
        agreedAt: Date.now(),
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

  // Anyone already on the team shouldn't see an application form. This also
  // catches a stale "?next=/apply" carried over from an earlier visit, which
  // would otherwise drop an Admin onto the form straight after signing in.
  const alreadyOnTeam =
    profile != null && profile.role !== "unassigned" && profile.role !== "applicant";

  if (alreadyOnTeam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10">
            <Logo priority className="mx-auto mb-4 h-10 w-auto" />
            <h1 className="text-lg font-semibold text-neutral-900">
              You&apos;re already on the team
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              You&apos;re signed in as {ROLE_LABELS[profile.role]}, so there&apos;s nothing to
              apply for.
            </p>
            <Button className="mt-6" onClick={() => router.replace("/dashboard")}>
              Go to my dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The application form stays locked until the email is confirmed, so every
  // applicant on file has a reachable address.
  if (!firebaseUser.emailVerified) {
    return <VerifyEmailScreen email={firebaseUser.email ?? ""} context="apply" />;
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

              <PhotoField photo={photo} onPick={handlePhotoPick} busy={photoBusy} />

              <CertificatesField
                certificates={certificates}
                onPick={handleCertificatePick}
                onRemove={removeCertificate}
                busy={certBusy}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="First Preference"
                  required
                  hint="You'll be shown this department's brief to accept"
                >
                  <Select
                    required
                    value={form.departmentPreference}
                    onChange={(e) => requestDepartment(1, e.target.value)}
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
                    onChange={(e) => requestDepartment(2, e.target.value)}
                  >
                    <option value="">None</option>
                    {departments
                      .filter((d) => d.name !== form.departmentPreference)
                      .map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                  </Select>
                </FormField>
              </div>

              {(form.departmentPreference || form.departmentPreference2) && (
                <div className="space-y-2">
                  {form.departmentPreference && (
                    <AgreementChip
                      label={`1st choice — ${form.departmentPreference}`}
                      agreed={agreed1}
                      onReview={() => requestDepartment(1, form.departmentPreference)}
                    />
                  )}
                  {form.departmentPreference2 && (
                    <AgreementChip
                      label={`2nd choice — ${form.departmentPreference2}`}
                      agreed={agreed2}
                      onReview={() => requestDepartment(2, form.departmentPreference2)}
                    />
                  )}
                </div>
              )}

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

      <DepartmentAgreementModal
        open={!!pending}
        department={pending?.department ?? null}
        preferenceLabel={pending?.slot === 2 ? "Second preference" : "First preference"}
        onAgree={confirmDepartment}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function PhotoField({
  photo,
  onPick,
  busy,
}: {
  photo: { file: File; preview: string } | null;
  onPick: (file: File) => void;
  busy: boolean;
}) {
  return (
    <FormField
      label="Passport-size photo"
      required
      hint="JPG or PNG. Large photos are resized automatically — no need to compress it yourself."
    >
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
          {photo ? (
            // Object URL of a local file — next/image can't optimise this.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.preview} alt="Your photo" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-neutral-300" />
          )}
        </div>
        <div className="min-w-0">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.target.value = "";
              }}
            />
            {busy ? "Processing…" : photo ? "Change photo" : "Choose photo"}
          </label>
          {photo && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Ready — {(photo.file.size / 1024).toFixed(0)} KB
            </p>
          )}
        </div>
      </div>
    </FormField>
  );
}

/**
 * Optional certificate attachments.
 *
 * Deliberately quiet in the form: it sits below the required photo and
 * states plainly that it can be skipped, so nobody assumes they are
 * ineligible for having nothing to attach.
 */
function CertificatesField({
  certificates,
  onPick,
  onRemove,
  busy,
}: {
  certificates: { file: File; preview: string }[];
  onPick: (file: File) => void;
  onRemove: (index: number) => void;
  busy: boolean;
}) {
  const full = certificates.length >= MAX_CERTIFICATES;

  return (
    <FormField
      label="Certificates (optional)"
      hint={`If you have any, attach up to ${MAX_CERTIFICATES}. JPG or PNG — each is compressed to 200 KB automatically. Leave empty if you have none.`}
    >
      <div className="space-y-3">
        {certificates.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {certificates.map((cert, i) => (
              <div
                key={cert.preview}
                className="relative w-32 overflow-hidden rounded-lg border border-neutral-200"
              >
                {/* Object URL of a local file — next/image can't optimise this. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cert.preview} alt="" className="h-20 w-full object-cover" />
                <div className="px-2 py-1.5">
                  <p className="truncate text-[11px] text-neutral-600">{cert.file.name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {(cert.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label="Remove certificate"
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-neutral-600 shadow-sm hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!full && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.target.value = "";
              }}
            />
            {busy
              ? "Processing…"
              : certificates.length === 0
              ? "Add a certificate"
              : "Add another"}
          </label>
        )}

        {full && (
          <p className="text-xs text-neutral-500">
            Both slots used. Remove one to swap it.
          </p>
        )}
      </div>
    </FormField>
  );
}

function AgreementChip({
  label,
  agreed,
  onReview,
}: {
  label: string;
  agreed: boolean;
  onReview: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
        agreed
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {agreed ? (
          <Check className="h-4 w-4 shrink-0" />
        ) : (
          <Ban className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </span>
      <button
        type="button"
        onClick={onReview}
        className="shrink-0 text-xs font-medium underline underline-offset-2"
      >
        {agreed ? "Read again" : "Read & accept"}
      </button>
    </div>
  );
}
