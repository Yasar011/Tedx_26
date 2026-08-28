"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Department, FileAsset } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { recordFileUpload } from "@/lib/files";
import { logActivity } from "@/lib/activity";
import { CloudinaryUploadResult } from "@/lib/cloudinary";
import { toast } from "sonner";
import { FolderOpen, FileImage, FileVideo, File as FileIcon } from "lucide-react";

export default function FilesPage() {
  const { profile } = useAuth();
  const [files, setFiles] = useState<FileAsset[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const canModerate = profile?.role === "admin" || profile?.role === "core" || profile?.role === "department_head";
  const isPrivileged = profile?.role === "admin" || profile?.role === "core";

  async function load() {
    if (!profile) return;
    let snap;
    if (isPrivileged) {
      snap = await getDocs(collection(db, "files"));
    } else if (profile.departmentId) {
      const deptSnap = await getDoc(doc(db, "departments", profile.departmentId));
      if (deptSnap.exists()) setDepartment({ id: deptSnap.id, ...deptSnap.data() } as Department);
      snap = await getDocs(query(collection(db, "files"), where("departmentId", "==", profile.departmentId)));
    } else {
      snap = await getDocs(query(collection(db, "files"), where("uploadedBy", "==", profile.uid)));
    }
    setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FileAsset)).sort((a, b) => b.uploadedAt - a.uploadedAt));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleUpload(result: CloudinaryUploadResult, file: File) {
    if (!profile) return;
    const folderSlug = department?.name.replace(/\s+/g, "-").toLowerCase() ?? "general";
    await recordFileUpload({
      result,
      fileName: file.name,
      uploadedBy: profile.uid,
      uploadedByName: profile.name,
      departmentId: profile.departmentId,
      folder: `TEDxNIFT/${folderSlug}`,
    });
    await logActivity({
      actorId: profile.uid,
      actorName: profile.name,
      action: "FILE_UPLOADED",
      targetType: "file",
      targetId: result.publicId,
      message: `${profile.name} uploaded ${file.name}`,
      departmentId: profile.departmentId,
    });
    load();
  }

  async function moderate(file: FileAsset, approvalStatus: "APPROVED" | "REJECTED") {
    if (!profile) return;
    await updateDoc(doc(db, "files", file.id), {
      approvalStatus,
      approvedBy: profile.uid,
      approvedByName: profile.name,
    });
    toast.success(`File ${approvalStatus.toLowerCase()}`);
    load();
  }

  if (loading) return <FullPageSpinner />;

  const filtered = statusFilter === "ALL" ? files : files.filter((f) => f.approvalStatus === statusFilter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Files</h1>
          <p className="text-sm text-neutral-500">{files.length} files</p>
        </div>
        <FileUpload folder="TEDxNIFT/general" onUploaded={handleUpload} label="Upload File" />
      </div>

      <div className="flex gap-2">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No files found" description="Upload department documents, media, or templates here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((file) => {
            const Icon = file.resourceType === "image" ? FileImage : file.resourceType === "video" ? FileVideo : FileIcon;
            return (
              <Card key={file.id}>
                <CardContent className="space-y-3 py-4">
                  <a href={file.cloudinaryUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-neutral-900 hover:underline">
                    <Icon className="h-4 w-4 text-neutral-400" />
                    <span className="truncate">{file.fileName}</span>
                  </a>
                  <p className="text-xs text-neutral-500">
                    {file.uploadedByName} · {formatDateTime(file.uploadedAt)}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge
                      className={
                        file.approvalStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : file.approvalStatus === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }
                    >
                      {file.approvalStatus}
                    </Badge>
                    {canModerate && file.approvalStatus === "PENDING" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => moderate(file, "APPROVED")}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => moderate(file, "REJECTED")}>Reject</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
