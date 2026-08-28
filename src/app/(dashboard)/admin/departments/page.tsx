"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Input";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { DEFAULT_DEPARTMENTS } from "@/lib/constants";

const emptyForm = {
  name: "",
  code: "",
  description: "",
  purpose: "",
  responsibilities: "",
  guidelines: "",
};

export default function AdminDepartmentsPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    const snap = await getDocs(collection(db, "departments"));
    setDepartments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Department)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      description: dept.description ?? "",
      purpose: dept.purpose ?? "",
      responsibilities: dept.responsibilities ?? "",
      guidelines: dept.guidelines ?? "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "departments", editing.id), { ...form });
        await logActivity({
          actorId: profile.uid,
          actorName: profile.name,
          action: "DEPARTMENT_UPDATED",
          targetType: "department",
          targetId: editing.id,
          message: `${profile.name} updated department ${form.name}`,
        });
      } else {
        const ref = await addDoc(collection(db, "departments"), {
          ...form,
          code: form.code.toUpperCase(),
          headUserId: null,
          active: true,
          applicationsOpen: true,
          createdAt: Date.now(),
        });
        await logActivity({
          actorId: profile.uid,
          actorName: profile.name,
          action: "DEPARTMENT_CREATED",
          targetType: "department",
          targetId: ref.id,
          message: `${profile.name} created department ${form.name}`,
        });
      }
      toast.success("Department saved");
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(dept: Department) {
    await updateDoc(doc(db, "departments", dept.id), { active: !dept.active });
    load();
  }

  async function toggleApplications(dept: Department) {
    await updateDoc(doc(db, "departments", dept.id), { applicationsOpen: !dept.applicationsOpen });
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget || !profile) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "departments", deleteTarget.id));
      await logActivity({
        actorId: profile.uid,
        actorName: profile.name,
        action: "DEPARTMENT_DELETED",
        targetType: "department",
        targetId: deleteTarget.id,
        message: `${profile.name} deleted department ${deleteTarget.name}`,
      });
      toast.success("Department deleted");
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  async function seedDefaults() {
    if (!profile) return;
    setSaving(true);
    try {
      for (const d of DEFAULT_DEPARTMENTS) {
        if (departments.some((existing) => existing.code === d.code)) continue;
        await addDoc(collection(db, "departments"), {
          name: d.name,
          code: d.code,
          description: "",
          purpose: "",
          responsibilities: "",
          guidelines: "",
          headUserId: null,
          active: true,
          applicationsOpen: true,
          createdAt: Date.now(),
        });
      }
      toast.success("Default departments added");
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Departments</h1>
          <p className="text-sm text-neutral-500">{departments.length} departments configured</p>
        </div>
        <div className="flex gap-2">
          {departments.length === 0 && (
            <Button variant="outline" onClick={seedDefaults} loading={saving}>
              Add default departments
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Department
          </Button>
        </div>
      </div>

      {departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Create your first department, or seed the default TEDxNIFT departments." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Card key={dept.id}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900">{dept.name}</p>
                    <p className="text-xs text-neutral-500">{dept.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(dept)} className="text-neutral-400 hover:text-neutral-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)} className="text-neutral-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-neutral-600">{dept.description || "No description yet."}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    className={dept.active ? "bg-emerald-100 text-emerald-700 cursor-pointer" : "bg-neutral-200 text-neutral-600 cursor-pointer"}
                    onClick={() => toggleActive(dept)}
                  >
                    {dept.active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge
                    className={dept.applicationsOpen ? "bg-blue-100 text-blue-700 cursor-pointer" : "bg-neutral-200 text-neutral-600 cursor-pointer"}
                    onClick={() => toggleApplications(dept)}
                  >
                    Applications {dept.applicationsOpen ? "Open" : "Closed"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Department" : "New Department"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Code" required hint="Used in TEDx IDs">
              <Input
                value={form.code}
                maxLength={4}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </FormField>
          </div>
          <FormField label="Description">
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Purpose">
            <Textarea rows={2} value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
          </FormField>
          <FormField label="Responsibilities">
            <Textarea rows={2} value={form.responsibilities} onChange={(e) => setForm((f) => ({ ...f, responsibilities: e.target.value }))} />
          </FormField>
          <FormField label="Guidelines">
            <Textarea rows={2} value={form.guidelines} onChange={(e) => setForm((f) => ({ ...f, guidelines: e.target.value }))} />
          </FormField>
          <Button className="w-full" onClick={save} loading={saving} disabled={!form.name || !form.code}>
            Save Department
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Department"
        description={`Delete "${deleteTarget?.name}"? This does not delete its members, tasks, or files, but they will be orphaned. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
