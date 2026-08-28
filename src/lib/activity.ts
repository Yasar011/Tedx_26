import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase/client";

export async function logActivity(params: {
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  message: string;
  departmentId?: string | null;
}) {
  await addDoc(collection(db, "activityLogs"), {
    ...params,
    departmentId: params.departmentId ?? null,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
  });
}
