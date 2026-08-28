import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase/client";

export async function notify(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string | null;
  link?: string | null;
}) {
  await addDoc(collection(db, "notifications"), {
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    relatedId: params.relatedId ?? null,
    link: params.link ?? null,
    read: false,
    createdAt: Date.now(),
  });
}

export async function notifyMany(
  userIds: string[],
  params: { title: string; message: string; type: string; relatedId?: string | null; link?: string | null }
) {
  await Promise.all(userIds.map((userId) => notify({ ...params, userId })));
}
