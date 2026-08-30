"use client";

import { useEffect, useRef, useState } from "react";
import { Department } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Users } from "lucide-react";

/**
 * Shows one department's full brief and requires an explicit acceptance.
 *
 * Only the department the applicant actually picked is shown, so the brief
 * is the thing they are agreeing to rather than a wall of every team. The
 * accept button stays disabled until they have scrolled to the end, so
 * "I agree" means they were at least shown all of it.
 */
export function DepartmentAgreementModal({
  open,
  department,
  preferenceLabel,
  onAgree,
  onCancel,
}: {
  open: boolean;
  department: Department | null;
  preferenceLabel: string;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [readToEnd, setReadToEnd] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReadToEnd(false);
    // Short briefs may not scroll at all — don't trap the applicant.
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, [open, department?.id]);

  if (!department) return null;

  const sections: { label: string; body?: string }[] = [
    { label: "About this department", body: department.description },
    { label: "Purpose", body: department.purpose },
    { label: "What you'll be responsible for", body: department.responsibilities },
    { label: "Goals", body: department.goals },
    { label: "Guidelines", body: department.guidelines },
  ].filter((s) => (s.body ?? "").trim().length > 0);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={`${preferenceLabel}: ${department.name}`}
      className="max-w-xl"
    >
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) setReadToEnd(true);
        }}
        className="max-h-[46vh] space-y-4 overflow-y-auto pr-1"
      >
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <Users className="h-3.5 w-3.5" />
            Who runs this department
          </p>
          <p className="mt-1.5 text-sm text-neutral-800">
            {department.headName ? (
              <>
                <span className="font-medium">Head:</span> {department.headName}
              </>
            ) : (
              <span className="text-neutral-500">A Head has not been assigned yet.</span>
            )}
          </p>
          {department.coHeadName && (
            <p className="text-sm text-neutral-800">
              <span className="font-medium">Co-Head:</span> {department.coHeadName}
            </p>
          )}
        </div>

        {sections.length === 0 ? (
          <p className="text-sm text-neutral-500">
            This department hasn&apos;t published a description yet. You can still choose it.
          </p>
        ) : (
          sections.map((s) => (
            <div key={s.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                {s.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                {s.body}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        {!readToEnd && (
          <p className="mb-3 text-center text-xs text-neutral-500">
            Scroll to the end to continue.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!readToEnd} onClick={onAgree}>
            I agree to join {department.name}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
