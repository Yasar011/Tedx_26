"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, Issue, IssuePriority, IssueStatus, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FileUpload } from "@/components/ui/FileUpload";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ISSUE_PRIORITY_COLORS, ISSUE_STATUS_COLORS, ISSUE_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { CloudinaryUploadResult } from "@/lib/cloudinary";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";
import { isDeptLead } from "@/lib/permissions";

const emptyForm = {
  title: "",
  location: "",
  departmentId: "",
  priority: "MEDIUM" as IssuePriority,
  description: "",
};

export default function IssuesPage() {
  const { profile } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  const canManage = profile?.role === "admin" || profile?.role === "core" || isDeptLead(profile);

  async function load() {
    const [issueSnap, deptSnap, userSnap] = await Promise.all([
      getDocs(collection(db, "issues")),
      getDocs(collection(db, "departments")),
      getDocs(collection(db, "users")),
    ]);
    setIssues(issueSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Issue)).sort((a, b) => b.createdAt - a.createdAt));
    setDepartments(deptSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
    setUsers(userSnap.docs.map((d) => d.data() as UserProfile));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function report() {
    if (!profile) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "issues"), {
        title: form.title,
        location: form.location,
        departmentId: form.departmentId || null,
        priority: form.priority,
        reportedBy: profile.uid,
        reportedByName: profile.name,
        description: form.description,
        attachmentUrl,
        status: "REPORTED",
        assignedTo: null,
        assignedToName: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "ISSUE_REPORTED",
        targetType: "issue",
        targetId: ref.id,
        message: `${profile.name} reported "${form.title}" (${form.priority}) at ${form.location}`,
        departmentId: form.departmentId || null,
      });
      toast.success("Issue reported");
      setModalOpen(false);
      setForm(emptyForm);
      setAttachmentUrl(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(issue: Issue, status: IssueStatus, assignedTo?: string) {
    const assignee = users.find((u) => u.uid === assignedTo);
    await updateDoc(doc(db, "issues", issue.id), {
      status,
      assignedTo: assignedTo || issue.assignedTo,
      assignedToName: assignee?.name ?? issue.assignedToName,
      updatedAt: Date.now(),
    });
    load();
  }

  function handleUploaded(result: CloudinaryUploadResult) {
    setAttachmentUrl(result.url);
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Issues & Incidents</h1>
          <p className="text-sm text-neutral-500">{issues.filter((i) => i.status !== "RESOLVED").length} open</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Report Issue
        </Button>
      </div>

      {issues.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No issues reported" />
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Card key={issue.id} className={issue.priority === "CRITICAL" && issue.status !== "RESOLVED" ? "border-red-300" : ""}>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-neutral-900">{issue.title}</p>
                    <p className="text-xs text-neutral-500">{issue.location} · Reported by {issue.reportedByName} · {formatDateTime(issue.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={ISSUE_PRIORITY_COLORS[issue.priority]}>{issue.priority}</Badge>
                    <Badge className={ISSUE_STATUS_COLORS[issue.status]}>{ISSUE_STATUS_LABELS[issue.status]}</Badge>
                  </div>
                </div>
                <p className="text-sm text-neutral-700">{issue.description}</p>
                {issue.attachmentUrl && (
                  <a href={issue.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                    View attachment
                  </a>
                )}
                {issue.assignedToName && <p className="text-xs text-neutral-500">Assigned to {issue.assignedToName}</p>}
                {canManage && issue.status !== "RESOLVED" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {issue.status === "REPORTED" && (
                      <Select className="w-40" onChange={(e) => updateStatus(issue, "ASSIGNED", e.target.value)} defaultValue="">
                        <option value="" disabled>Assign to…</option>
                        {users.map((u) => (
                          <option key={u.uid} value={u.uid}>{u.name}</option>
                        ))}
                      </Select>
                    )}
                    {issue.status === "ASSIGNED" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(issue, "IN_PROGRESS")}>Mark In Progress</Button>
                    )}
                    {(issue.status === "ASSIGNED" || issue.status === "IN_PROGRESS") && (
                      <Button size="sm" onClick={() => updateStatus(issue, "RESOLVED")}>Mark Resolved</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Report Issue">
        <div className="space-y-4">
          <FormField label="Issue" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Location" required>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </FormField>
            <FormField label="Priority">
              <Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as IssuePriority }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </FormField>
          </div>
          <FormField label="Department">
            <Select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
              <option value="">Not department-specific</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description" required>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FileUpload folder="TEDxNIFT/issues" onUploaded={handleUploaded} label={attachmentUrl ? "Replace attachment" : "Attach photo/file"} />
          <Button className="w-full" onClick={report} loading={saving} disabled={!form.title || !form.location || !form.description}>
            Report Issue
          </Button>
        </div>
      </Modal>
    </div>
  );
}
