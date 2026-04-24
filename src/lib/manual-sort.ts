export type ManualSortOrders = Record<string, number>;

export function parseManualSortOrders(viewOptions: unknown): ManualSortOrders | null {
  if (!viewOptions || typeof viewOptions !== "object" || Array.isArray(viewOptions)) {
    return null;
  }

  const manualSort = (viewOptions as Record<string, unknown>).manualSort;
  if (!manualSort || typeof manualSort !== "object" || Array.isArray(manualSort)) {
    return null;
  }

  if ((manualSort as Record<string, unknown>).enabled === false) {
    return null;
  }

  const orders = (manualSort as Record<string, unknown>).orders;
  if (!orders || typeof orders !== "object" || Array.isArray(orders)) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(orders).flatMap(([recordId, order]) => {
      const value = Number(order);
      return Number.isFinite(value) ? [[recordId, value]] : [];
    })
  );

  return Object.keys(normalized).length > 0 ? normalized : null;
}
