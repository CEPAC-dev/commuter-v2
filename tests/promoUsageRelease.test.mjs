import test from "node:test";
import assert from "node:assert/strict";

const { releasePromoUsageForTripWith } = await import(
  "../src/lib/promoUsageRelease.ts"
);

for (const path of ["waitlist rejection", "expiry", "unpaid cancellation"]) {
  test(`releases promo usage only once on ${path}`, async () => {
    const usages = new Map([
      ["usage-1", { id: "usage-1", promoCodeId: "promo-1" }],
    ]);
    const usedCounts = new Map([["promo-1", 1]]);
    const store = {
      async findUsageForTrip() {
        return [...usages.values()];
      },
      async deleteUsage(id) {
        return usages.delete(id);
      },
      async decrementUsedCount(promoCodeId) {
        usedCounts.set(promoCodeId, usedCounts.get(promoCodeId) - 1);
      },
    };

    assert.equal(await releasePromoUsageForTripWith(store, "trip-1"), 1);
    assert.equal(await releasePromoUsageForTripWith(store, "trip-1"), 0);
    assert.equal(usages.size, 0);
    assert.equal(usedCounts.get("promo-1"), 0);
  });
}
