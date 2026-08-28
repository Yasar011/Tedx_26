"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary, CloudinaryUploadResult } from "@/lib/cloudinary";
import { Spinner } from "./Spinner";

export function FileUpload({
  folder,
  onUploaded,
  label = "Upload file",
  accept,
}: {
  folder: string;
  onUploaded: (result: CloudinaryUploadResult, file: File) => void | Promise<void>;
  label?: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, folder);
      await onUploaded(result, file);
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
      >
        {uploading ? <Spinner className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
        {uploading ? "Uploading…" : label}
      </button>
    </div>
  );
}
