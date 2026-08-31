import { auth } from "./firebase/client";
import { formatDateTime } from "./utils";

export interface SendResult {
  ok: boolean;
  remaining?: number;
  error?: string;
}

/**
 * Sends one notification email via the server relay.
 *
 * Never throws: an email failing must not roll back the decision that
 * triggered it. A Head shortlisting someone should still be shortlisted
 * even if the daily Gmail quota (100/day on a free account) has run out —
 * the caller surfaces the returned error instead.
 */
export async function sendApplicantEmail(params: {
  to: string;
  subject: string;
  heading: string;
  message: string;
  detail?: string;
  /** Who acted, shown as a signature so the mail isn't faceless. */
  senderName?: string;
  senderTitle?: string;
}): Promise<SendResult> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { ok: false, error: "Not signed in" };

    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(params),
    });
    return (await res.json()) as SendResult;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

/** Remaining sends for today, or null if the relay isn't configured. */
export async function getEmailQuota(): Promise<number | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return null;
    const res = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action: "quota" }),
    });
    const data = await res.json();
    return typeof data?.remaining === "number" ? data.remaining : null;
  } catch {
    return null;
  }
}

const EVENT = "TEDxNIFT Jodhpur";

/**
 * How the sender is described at the foot of an applicant email.
 * A Head signs as the head of their department; org leadership signs for
 * the organising team.
 */
export function senderTitleFor(
  role: string | undefined,
  departmentName?: string | null
): string {
  // Acting for one department — a Head, or an Admin/Core member working
  // inside a specific team's applicant list.
  if (departmentName && (role === "department_head" || role === "admin" || role === "core")) {
    return `Head of ${departmentName}, ${EVENT}`;
  }
  // Acting org-wide, e.g. issuing a TEDx ID from the Approval Center.
  if (role === "admin") return `Organising Head, ${EVENT}`;
  if (role === "core") return `Core Organising Team, ${EVENT}`;
  return EVENT;
}

export const applicantEmails = {
  shortlisted(name: string, department: string) {
    return {
      subject: `You've been shortlisted — ${EVENT}`,
      heading: `Good news, ${name.split(" ")[0]}!`,
      message: `Your application to the ${department} team has been shortlisted. The next step is a short interview — we'll email you the date and time shortly.`,
      detail: "You can track your status any time by signing in to the platform.",
    };
  },

  interviewScheduled(name: string, department: string, whenMs: number, note?: string) {
    return {
      subject: `Confirm your interview — ${EVENT}`,
      heading: `Interview scheduled, ${name.split(" ")[0]}`,
      message: `Your interview for the ${department} team has been scheduled. Please sign in and confirm you can make it — unconfirmed interviews are not held.`,
      detail: [
        `When: ${formatDateTime(whenMs)}`,
        note ? `Note: ${note}` : "",
        `Sign in to the platform and choose "I'll be there" to confirm, or decline if you can't make it.`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  },

  interviewUpdated(name: string, department: string, whenMs: number) {
    return {
      subject: `Your interview time has changed — ${EVENT}`,
      heading: `Updated interview time, ${name.split(" ")[0]}`,
      message: `The interview for your ${department} application has been rescheduled.`,
      detail: `New time: ${formatDateTime(whenMs)}`,
    };
  },

  approved(name: string, department: string, tedxId: string, approvedBy?: string) {
    return {
      subject: `Welcome to the team — ${EVENT}`,
      heading: `You're in, ${name.split(" ")[0]}!`,
      message:
        `Your application has been approved${approvedBy ? ` by ${approvedBy}` : ""}, and ` +
        `you're joining the ${department} team for ${EVENT}. Sign in to see your dashboard, ` +
        `your department and your first tasks.`,
      detail: `Your TEDx Member ID: ${tedxId}\nDepartment: ${department}`,
    };
  },

  rejected(name: string, department: string, reason?: string) {
    return {
      subject: `Update on your application — ${EVENT}`,
      heading: `Thank you for applying, ${name.split(" ")[0]}`,
      message: `We're sorry — your application to the ${department} team wasn't successful this time. We had a lot of strong applicants, and we'd genuinely encourage you to apply again for the next edition.`,
      detail: reason ? `Feedback: ${reason}` : "",
    };
  },

  secondPreferenceOffered(name: string, rejectedBy: string, secondChoice: string) {
    return {
      subject: `Your second choice — ${EVENT}`,
      heading: `One more option, ${name.split(" ")[0]}`,
      message: `The ${rejectedBy} team wasn't able to take your application forward. You listed ${secondChoice} as your second preference, so we can pass your application to them instead — if you're still interested.`,
      detail:
        `Sign in and choose "Continue with ${secondChoice}" to send it on, or decline if you'd ` +
        `rather not. Nothing changes until you decide.\n\n` +
        `Please note the ${secondChoice} team will review your application and make their own ` +
        `decision — this isn't a guaranteed place, it puts you back in the running with them.`,
    };
  },

  waitlisted(name: string, department: string) {
    return {
      subject: `You're on the waitlist — ${EVENT}`,
      heading: `You're on the waitlist, ${name.split(" ")[0]}`,
      message: `Your application to the ${department} team has been placed on the waitlist. We'll be in touch if a place opens up.`,
      detail: "",
    };
  },
};
