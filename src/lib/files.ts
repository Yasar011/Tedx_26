import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase/client";
import { CloudinaryUploadResult } from "./cloudinary";

export async function recordFileUpload(params: {
  result: CloudinaryUploadResult;
  fileName: string;
  uploadedBy: string;
  uploadedByName: string;
  departmentId: string | null;
  relatedTaskId?: string | null;
  folder: string;
}) {
  const ref = await addDoc(collection(db, "files"), {
    cloudinaryUrl: params.result.url,
    publicId: params.result.publicId,
    resourceType: params.result.resourceType,
    fileName: params.fileName,
    fileSize: params.result.bytes,
    uploadedBy: params.uploadedBy,
    uploadedByName: params.uploadedByName,
    departmentId: params.departmentId,
    uploadedAt: Date.now(),
    relatedTaskId: params.relatedTaskId ?? null,
    folder: params.folder,
    approvalStatus: "PENDING",
    approvedBy: null,
    approvedByName: null,
  });
  return ref.id;
}
