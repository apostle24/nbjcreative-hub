import { describe, expect, it } from "vitest";
import {
  getProductDownloadContentType,
  validateProductDownloadFiles
} from "../lib/product-downloads";

describe("product download upload validation", () => {
  it("maps supported extensions to Storage-allowed MIME types", () => {
    expect(getProductDownloadContentType({ name: "guide.PDF", type: "application/pdf", size: 10 })).toBe("application/pdf");
    expect(getProductDownloadContentType({ name: "archive.zip", type: "application/x-zip-compressed", size: 10 })).toBe("application/zip");
    expect(getProductDownloadContentType({ name: "sheet.csv", type: "", size: 10 })).toBe("text/csv");
  });

  it("uses the extension mapping when the browser reports a generic MIME type", () => {
    expect(getProductDownloadContentType({ name: "archive.zip", type: "application/octet-stream", size: 10 })).toBe("application/zip");
  });

  it("rejects unsupported extensions and conflicting specific MIME types", () => {
    expect(getProductDownloadContentType({ name: "payload.exe", type: "application/octet-stream", size: 10 })).toBeNull();
    expect(getProductDownloadContentType({ name: "notes.pdf", type: "image/png", size: 10 })).toBeNull();
  });

  it("enforces file count, non-empty files and the 50 MB per-file limit", () => {
    const valid = { name: "guide.pdf", type: "application/pdf", size: 10 };
    expect(validateProductDownloadFiles(Array(11).fill(valid))).toContain("up to 10");
    expect(validateProductDownloadFiles([{ ...valid, size: 0 }])).toContain("empty");
    expect(validateProductDownloadFiles([{ ...valid, size: 50 * 1024 * 1024 + 1 }])).toContain("50 MB");
    expect(validateProductDownloadFiles([valid])).toBeNull();
  });
});
