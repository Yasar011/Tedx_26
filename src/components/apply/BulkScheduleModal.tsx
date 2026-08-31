"use client";

import { useMemo, useState } from "react";
import { Application } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, Input } from "@/components/ui/Input";
import { buildSlots, DEFAULT_SLOT_PLAN, Slot, SlotPlan } from "@/lib/slots";
import { formatDateTime } from "@/lib/utils";

/**
 * Assigns interview slots to a whole shortlist at once.
 *
 * Fifty applicants can't share one time, and entering fifty times by hand
 * isn't realistic — this lays them out back-to-back from a start time and
 * rolls onto the next day once the daily limit is hit. The exact schedule
 * is previewed before anything is written or emailed, since this both
 * creates records and sends mail to every person listed.
 */
export function BulkScheduleModal({
  open,
  applicants,
  onClose,
  onConfirm,
  progress,
  running,
}: {
  open: boolean;
  applicants: Application[];
  onClose: () => void;
  onConfirm: (slots: Slot[]) => void;
  /** "12 / 50" style progress while sending. */
  progress: { done: number; total: number } | null;
  running: boolean;
}) {
  const [plan, setPlan] = useState<SlotPlan>(() => ({
    ...DEFAULT_SLOT_PLAN,
    startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  }));

  const slots = useMemo(
    () =>
      buildSlots(
        applicants.map((a) => ({ id: a.id, name: a.name, email: a.email })),
        plan
      ),
    [applicants, plan]
  );

  function set<K extends keyof SlotPlan>(key: K, value: SlotPlan[K]) {
    setPlan((p) => ({ ...p, [key]: value }));
  }

  const days = slots.length > 0 ? Math.ceil(slots.length / Math.max(1, plan.perDay)) : 0;

  return (
    <Modal
      open={open}
      onClose={running ? () => {} : onClose}
      title={`Schedule ${applicants.length} interview${applicants.length !== 1 ? "s" : ""}`}
      className="max-w-2xl"
    >
      {applicants.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Nobody is shortlisted and still waiting on an interview time.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First interview date" required>
              <Input
                type="date"
                value={plan.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </FormField>
            <FormField label="Start time each day" required>
              <Input
                type="time"
                value={plan.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </FormField>
            <FormField label="Minutes per interview">
              <Input
                type="number"
                min={5}
                value={plan.minutesEach}
                onChange={(e) => set("minutesEach", Number(e.target.value))}
              />
            </FormField>
            <FormField label="Gap between (minutes)">
              <Input
                type="number"
                min={0}
                value={plan.gapMinutes}
                onChange={(e) => set("gapMinutes", Number(e.target.value))}
              />
            </FormField>
            <FormField label="Interviews per day" hint="Then it rolls to the next day">
              <Input
                type="number"
                min={1}
                value={plan.perDay}
                onChange={(e) => set("perDay", Number(e.target.value))}
              />
            </FormField>
          </div>

          {slots.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p className="font-medium text-neutral-800">
                {slots.length} interviews across {days} day{days !== 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                Each person is emailed their own time and must confirm it.
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Preview
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-neutral-200">
              {slots.map((s, i) => (
                <div
                  key={s.applicationId}
                  className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate text-neutral-800">
                    <span className="mr-2 text-neutral-400">{i + 1}.</span>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-neutral-600">{formatDateTime(s.startsAt)}</span>
                </div>
              ))}
            </div>
          </div>

          {progress && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-neutral-600">
                <span>Scheduling and emailing…</span>
                <span>
                  {progress.done} / {progress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-[#EB0028] transition-all"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={running}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={running}
              disabled={slots.length === 0 || !plan.startDate}
              onClick={() => onConfirm(slots)}
            >
              Schedule &amp; email {slots.length}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
