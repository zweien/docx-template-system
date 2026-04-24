interface DragSortStateInput {
  isAdmin: boolean;
  hasActiveSorts: boolean;
  hasGroupBy: boolean;
}

export function getDragSortState({
  isAdmin,
  hasActiveSorts,
  hasGroupBy,
}: DragSortStateInput) {
  if (!isAdmin) {
    return {
      enabled: false,
      title: "仅管理员可拖动排序",
    };
  }

  if (hasActiveSorts && hasGroupBy) {
    return {
      enabled: false,
      title: "清除当前排序并取消分组后可拖动排序",
    };
  }

  if (hasActiveSorts) {
    return {
      enabled: false,
      title: "清除当前排序后可拖动排序",
    };
  }

  if (hasGroupBy) {
    return {
      enabled: false,
      title: "取消分组后可拖动排序",
    };
  }

  return {
    enabled: true,
    title: "拖动排序",
  };
}

export function buildInsertedRecordOrder(
  recordIds: string[],
  referenceRecordId: string,
  position: "above" | "below",
  insertedRecordId: string
) {
  const referenceIndex = recordIds.indexOf(referenceRecordId);
  if (referenceIndex === -1) {
    return null;
  }

  const insertAt = position === "above" ? referenceIndex : referenceIndex + 1;
  return [
    ...recordIds.slice(0, insertAt),
    insertedRecordId,
    ...recordIds.slice(insertAt),
  ];
}
