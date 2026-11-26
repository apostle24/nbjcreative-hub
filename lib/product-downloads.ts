export const PRODUCT_DOWNLOAD_MAX_FILES = 10;
export const PRODUCT_DOWNLOAD_MAX_BYTES = 50 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain"
};

const MIME_ALIASES: Record<string, string[]> = {
  zip: ["application/x-zip-compressed", "application/x-zip"],
  csv: ["application/vnd.ms-excel"]
};

export type ProductDownloadFile = Pick<File, "name" | "type" | "size">;

/**
 * Resolve a Storage-allowlisted MIME type from the file extension.
 * Browsers that report no MIME type (or the generic octet-stream type)
 * are supported; known platform aliases are normalized. A conflicting,
 * specific browser MIME type is rejected.
 */
export function getProductDownloadContentType(file: ProductDownloadFile): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expected = MIME_BY_EXTENSION[extension];
  if (!expected) return null;

  const reported = file.type.trim().toLowerCase();
  if (!reported || reported === "application/octet-stream" || reported === expected) return expected;
  if ((MIME_ALIASES[extension] ?? []).includes(reported)) return expected;
  return null;
}

export function validateProductDownloadFiles(files: ProductDownloadFile[]): string | null {
  if (files.length > PRODUCT_DOWNLOAD_MAX_FILES) {
    return "Upload up to 10 downloadable files.";
  }
  for (const file of files) {
    if (file.size <= 0) return file.name + " is empty.";
    if (file.size > PRODUCT_DOWNLOAD_MAX_BYTES) {
      return file.name + " exceeds the 50 MB per-file limit.";
    }
    if (!getProductDownloadContentType(file)) {
      return file.name + " has an unsupported file type or MIME type. Use PDF, ZIP, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV or TXT.";
    }
  }
  return null;
}
