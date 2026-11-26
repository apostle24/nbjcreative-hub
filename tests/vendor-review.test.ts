import { describe, expect, it } from "vitest";
import { isVendorReviewStatus } from "../lib/vendor-review";

describe("vendor review status validation", () => {
  it.each(["pending", "approved", "rejected", "suspended"])("accepts %s", status => {
    expect(isVendorReviewStatus(status)).toBe(true);
  });

  it.each(["", "deleted", "active", null, undefined, 1])("rejects invalid status %s", status => {
    expect(isVendorReviewStatus(status)).toBe(false);
  });
});
