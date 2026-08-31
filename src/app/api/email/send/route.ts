import { NextResponse } from "next/server";

/**
 * Relays a notification email through the Google Apps Script Web App.
 *
 * This lives server-side on purpose: the Apps Script URL and shared secret
 * must never reach the browser, or anyone could POST to it and burn the
 * daily send quota (or send mail as the organisers). Callers must present
 * a valid Firebase ID token, and only staff roles may send.
 */

interface FirebaseUser {
  localId: string;
  email?: string;
}

async function verifyIdToken(idToken: string): Promise<FirebaseUser | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0] ?? null;
}

/** Reads the caller's role straight from Firestore via REST. */
async function getRole(uid: string, idToken: string): Promise<string | null> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.fields?.role?.stringValue ?? null;
}

const ALLOWED_SENDER_ROLES = ["admin", "core", "department_head"];

export async function POST(req: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SHARED_SECRET;

  if (!scriptUrl || !secret) {
    return NextResponse.json(
      { ok: false, error: "Email relay is not configured yet." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyIdToken(idToken);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = await getRole(user.localId, idToken);
  const isFoundingAdmin = user.localId === process.env.NEXT_PUBLIC_FOUNDING_ADMIN_UID;
  if (!isFoundingAdmin && (!role || !ALLOWED_SENDER_ROLES.includes(role))) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // Quota check — used by the dashboard to show the remaining allowance.
  if (body.action === "quota") {
    const res = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action: "quota" }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    return NextResponse.json(data);
  }

  const { to, subject, heading, message, detail, senderName, senderTitle } = body;
  if (!to || !subject) {
    return NextResponse.json(
      { ok: false, error: "Missing recipient or subject" },
      { status: 400 }
    );
  }

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret, to, subject, heading, message, detail, senderName, senderTitle,
    }),
  });

  const data = await res.json().catch(() => ({ ok: false, error: "Relay error" }));
  return NextResponse.json(data);
}
