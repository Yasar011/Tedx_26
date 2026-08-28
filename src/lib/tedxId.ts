import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase/client";

export async function generateTedxId(departmentCode: string): Promise<string> {
  const settingsSnap = await getDoc(doc(db, "settings", "event"));
  const year = settingsSnap.exists() ? settingsSnap.data().year : new Date().getFullYear();
  const yearShort = String(year).slice(-2);

  const counterRef = doc(db, "counters", departmentCode);

  const nextNumber = await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const current = counterSnap.exists() ? counterSnap.data().count ?? 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  const padded = String(nextNumber).padStart(4, "0");
  return `TEDX${yearShort}-${departmentCode}-${padded}`;
}
