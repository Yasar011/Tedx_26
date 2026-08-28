"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Notification } from "@/lib/types";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(
      query(
        collection(db, "notifications"),
        where("userId", "==", profile.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      ),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification)));
      }
    );
    return () => unsub();
  }, [profile]);

  const unreadCount = items.filter((n) => !n.read).length;

  async function handleClick(n: Notification) {
    if (!n.read) await updateDoc(doc(db, "notifications", n.id), { read: true });
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#EB0028] text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-neutral-200 bg-white shadow-lg">
            <div className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900">
              Notifications
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-neutral-500">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "block w-full border-b border-neutral-50 px-4 py-3 text-left text-sm hover:bg-neutral-50",
                      !n.read && "bg-red-50/50"
                    )}
                  >
                    <p className="font-medium text-neutral-900">{n.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{n.message}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">{formatDateTime(n.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
