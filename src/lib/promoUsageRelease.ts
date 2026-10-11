export interface PromoUsageReleaseRecord {
  id: string;
  promoCodeId: string;
}

export interface PromoUsageReleaseStore {
  findUsageForTrip(tripId: string): Promise<PromoUsageReleaseRecord[]>;
  deleteUsage(id: string): Promise<boolean>;
  decrementUsedCount(promoCodeId: string): Promise<void>;
}

export async function releasePromoUsageForTripWith(
  store: PromoUsageReleaseStore,
  tripId: string,
): Promise<number> {
  const usages = await store.findUsageForTrip(tripId);
  let released = 0;
  for (const usage of usages) {
    if (!(await store.deleteUsage(usage.id))) continue;
    await store.decrementUsedCount(usage.promoCodeId);
    released += 1;
  }
  return released;
}
