"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { KnowledgeArticle } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { BookOpen, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

const SEED_ARTICLES = [
  { title: "What is TEDx?", content: "TEDx is a program of local, self-organized events that bring people together to share a TED-like experience." },
  { title: "What is TEDxNIFT Jodhpur?", content: "TEDxNIFT Jodhpur is the independently organized TEDx event hosted by NIFT Jodhpur." },
  { title: "Organization Structure", content: "Core Organizing Team → Departments → Department Heads → Volunteers." },
  { title: "Rules & Brand Guidelines", content: "Follow official TEDx brand guidelines. Never alter the TEDx logo. Keep communications professional." },
];

export default function KnowledgeBasePage() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  const canEdit = profile?.role === "admin";

  async function load() {
    const snap = await getDocs(query(collection(db, "knowledgeBase"), orderBy("order", "asc")));
    setArticles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as KnowledgeArticle)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function seed() {
    for (let i = 0; i < SEED_ARTICLES.length; i++) {
      await addDoc(collection(db, "knowledgeBase"), {
        ...SEED_ARTICLES[i],
        order: i,
        updatedBy: profile!.uid,
        updatedAt: Date.now(),
      });
    }
    toast.success("Starter articles added");
    load();
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: "", content: "" });
    setModalOpen(true);
  }

  function openEdit(article: KnowledgeArticle) {
    setEditing(article);
    setForm({ title: article.title, content: article.content });
    setModalOpen(true);
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "knowledgeBase", editing.id), {
          title: form.title,
          content: form.content,
          updatedBy: profile.uid,
          updatedAt: Date.now(),
        });
      } else {
        await addDoc(collection(db, "knowledgeBase"), {
          title: form.title,
          content: form.content,
          order: articles.length,
          updatedBy: profile.uid,
          updatedAt: Date.now(),
        });
      }
      toast.success("Saved");
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(article: KnowledgeArticle) {
    await deleteDoc(doc(db, "knowledgeBase", article.id));
    load();
  }

  async function move(article: KnowledgeArticle, direction: -1 | 1) {
    const idx = articles.findIndex((a) => a.id === article.id);
    const swapWith = articles[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      updateDoc(doc(db, "knowledgeBase", article.id), { order: swapWith.order }),
      updateDoc(doc(db, "knowledgeBase", swapWith.id), { order: article.order }),
    ]);
    load();
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Start Here — Knowledge Base</h1>
          <p className="text-sm text-neutral-500">Everything new team members need to know.</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New Article
          </Button>
        )}
      </div>

      {articles.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Knowledge base is empty"
          description={canEdit ? "Add starter articles to get going." : "Check back soon."}
          action={canEdit ? <Button onClick={seed}>Add Starter Articles</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {articles.map((article, idx) => (
            <Card key={article.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-neutral-900">{article.title}</h2>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button disabled={idx === 0} onClick={() => move(article, -1)} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button disabled={idx === articles.length - 1} onClick={() => move(article, 1)} className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(article)} className="text-neutral-400 hover:text-neutral-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(article)} className="text-neutral-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{article.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Article" : "New Article"}>
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Content" required>
            <Textarea rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
          </FormField>
          <Button className="w-full" onClick={save} loading={saving} disabled={!form.title || !form.content}>
            Save
          </Button>
        </div>
      </Modal>
    </div>
  );
}
