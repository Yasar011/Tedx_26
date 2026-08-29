"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Task, TaskComment, TaskStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { FileUpload } from "@/components/ui/FileUpload";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { TASK_PRIORITY_COLORS, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { recordFileUpload } from "@/lib/files";
import { CloudinaryUploadResult } from "@/lib/cloudinary";
import { isDeptLead } from "@/lib/permissions";
import { toast } from "sonner";
import { ArrowLeft, Paperclip } from "lucide-react";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [dependency, setDependency] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const snap = await getDoc(doc(db, "tasks", id));
    if (!snap.exists()) {
      setLoading(false);
      return;
    }
    const t = { id: snap.id, ...snap.data() } as Task;
    setTask(t);
    if (t.dependsOn) {
      const depSnap = await getDoc(doc(db, "tasks", t.dependsOn));
      if (depSnap.exists()) setDependency({ id: depSnap.id, ...depSnap.data() } as Task);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Sorted in memory rather than via orderBy(), which would pair with the
    // where() to require a composite index.
    const unsub = onSnapshot(
      query(collection(db, "taskComments"), where("taskId", "==", id)),
      (snap) =>
        setComments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as TaskComment))
            .sort((a, b) => a.createdAt - b.createdAt)
        ),
      () => setComments([])
    );
    return () => unsub();
  }, [id]);

  if (loading) return <FullPageSpinner />;
  if (!task) return <p className="text-sm text-neutral-500">Task not found.</p>;

  const isAssignee = profile?.uid === task.assignedTo;
  const isManager = isDeptLead(profile) || profile?.role === "admin";
  const dependencyBlocked = !!dependency && dependency.status !== "APPROVED" && dependency.status !== "COMPLETED";

  async function setStatus(status: TaskStatus, note?: string) {
    if (!profile || !task) return;
    if ((status === "IN_PROGRESS" || status === "SUBMITTED_FOR_REVIEW") && dependencyBlocked) {
      toast.error(`Blocked — depends on "${dependency?.title}" which isn't completed yet`);
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "tasks", task.id), { status, updatedAt: Date.now() });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "TASK_STATUS_CHANGED",
        targetType: "task",
        targetId: task.id,
        message: `${profile.name} moved "${task.title}" to ${TASK_STATUS_LABELS[status]}${note ? `: ${note}` : ""}`,
        departmentId: task.departmentId,
      });
      const notifyTarget = status === "SUBMITTED_FOR_REVIEW" ? null : task.assignedTo;
      if (status === "SUBMITTED_FOR_REVIEW" && task.createdBy) {
        await notify({
          userId: task.createdBy,
          title: "Task submitted for review",
          message: `${profile.name} submitted "${task.title}" for review`,
          type: "TASK_SUBMITTED",
          relatedId: task.id,
          link: `/tasks/${task.id}`,
        });
      } else if ((status === "APPROVED" || status === "REVISION_REQUIRED") && notifyTarget) {
        await notify({
          userId: notifyTarget,
          title: status === "APPROVED" ? "Task approved" : "Revision requested",
          message: `"${task.title}" was ${status === "APPROVED" ? "approved" : "sent back for revision"}${note ? `: ${note}` : ""}`,
          type: `TASK_${status}`,
          relatedId: task.id,
          link: `/tasks/${task.id}`,
        });
      }
      toast.success(`Task marked ${TASK_STATUS_LABELS[status]}`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    if (!profile || !task || !comment.trim()) return;
    await addDoc(collection(db, "taskComments"), {
      taskId: task.id,
      authorId: profile.uid,
      authorName: profile.name,
      message: comment.trim(),
      createdAt: Date.now(),
    });
    setComment("");
  }

  async function handleUpload(result: CloudinaryUploadResult, file: File) {
    if (!profile || !task) return;
    const fileId = await recordFileUpload({
      result,
      fileName: file.name,
      uploadedBy: profile.uid,
      uploadedByName: profile.name,
      departmentId: task.departmentId,
      relatedTaskId: task.id,
      folder: `TEDxNIFT/${task.departmentName.replace(/\s+/g, "-").toLowerCase()}`,
    });
    await updateDoc(doc(db, "tasks", task.id), {
      attachments: [...task.attachments, { fileId, url: result.url, fileName: file.name }],
      updatedAt: Date.now(),
    });
    load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{task.title}</h1>
          <p className="text-sm text-neutral-500">
            {task.departmentName} · Assigned to {task.assignedToName ?? "Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className={TASK_PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
          <Badge className={TASK_STATUS_COLORS[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
        </div>
      </div>

      {dependency && (
        <Card className={dependencyBlocked ? "border-amber-300 bg-amber-50" : ""}>
          <CardContent className="py-3 text-sm">
            Depends on <Link href={`/tasks/${dependency.id}`} className="font-medium underline">{dependency.title}</Link>{" "}
            — currently {TASK_STATUS_LABELS[dependency.status]}
            {dependencyBlocked && ". This task cannot move forward until that one is completed."}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-neutral-700">
          <p>{task.description || "No description provided."}</p>
          <p className="text-xs text-neutral-500">
            {task.startDate && `Start ${formatDate(task.startDate)}`}
            {task.startDate && task.deadline && " · "}
            {task.deadline && `Due ${formatDate(task.deadline)}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {task.attachments.length === 0 && <p className="text-sm text-neutral-500">No files attached yet.</p>}
          {task.attachments.map((a) => (
            <a key={a.fileId} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
              <Paperclip className="h-4 w-4" /> {a.fileName}
            </a>
          ))}
          {(isAssignee || isManager) && (
            <FileUpload folder={`TEDxNIFT/${task.departmentName}`} onUploaded={handleUpload} label="Attach file" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isAssignee && task.status === "TO_DO" && (
            <Button size="sm" loading={busy} onClick={() => setStatus("IN_PROGRESS")}>Start Task</Button>
          )}
          {isAssignee && task.status === "IN_PROGRESS" && (
            <Button size="sm" loading={busy} onClick={() => setStatus("SUBMITTED_FOR_REVIEW")}>Submit for Review</Button>
          )}
          {isAssignee && task.status === "REVISION_REQUIRED" && (
            <Button size="sm" loading={busy} onClick={() => setStatus("IN_PROGRESS")}>Resume Work</Button>
          )}
          {isManager && task.status === "SUBMITTED_FOR_REVIEW" && (
            <>
              <Button size="sm" loading={busy} onClick={() => setStatus("APPROVED")}>Approve</Button>
              <Button size="sm" variant="outline" loading={busy} onClick={() => setStatus("REVISION_REQUIRED", comment)}>
                Request Revision
              </Button>
            </>
          )}
          {isManager && task.status === "APPROVED" && (
            <Button size="sm" loading={busy} onClick={() => setStatus("COMPLETED")}>Mark Completed</Button>
          )}
          {!isAssignee && !isManager && (
            <p className="text-sm text-neutral-500">You can view this task but cannot change its status.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <p className="font-medium text-neutral-900">{c.authorName} <span className="ml-2 text-xs font-normal text-neutral-400">{formatDateTime(c.createdAt)}</span></p>
              <p className="text-neutral-700">{c.message}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <Button onClick={postComment} disabled={!comment.trim()}>Post</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
