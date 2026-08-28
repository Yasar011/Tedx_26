import { NextResponse } from "next/server";
import crypto from "crypto";

async function verifyIdToken(idToken: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  return res.ok;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken || !(await verifyIdToken(idToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const folder: string = body.folder || "TEDxNIFT/misc";
  const useFallback: boolean = !!body.useFallback;

  const apiKey = useFallback ? process.env.CLOUDINARY_API_KEY_FALLBACK : process.env.CLOUDINARY_API_KEY;
  const apiSecret = useFallback ? process.env.CLOUDINARY_API_SECRET_FALLBACK : process.env.CLOUDINARY_API_SECRET;
  const cloudName = useFallback
    ? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME_FALLBACK
    : process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    return NextResponse.json({ error: "Cloudinary is not configured" }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder });
}
