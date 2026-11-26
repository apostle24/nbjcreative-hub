export const VENDOR_REVIEW_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;

export type VendorReviewStatus = typeof VENDOR_REVIEW_STATUSES[number];

export function isVendorReviewStatus(value: unknown): value is VendorReviewStatus {
  return typeof value === "string" &&
    VENDOR_REVIEW_STATUSES.includes(value as VendorReviewStatus);
}
