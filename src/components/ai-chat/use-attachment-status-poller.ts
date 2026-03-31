"use client";

import { useEffect, useMemo, useState } from "react";

export interface AttachmentStatusItem {
  id: string;
  fileName: string;
  extractStatus?: "pending" | "processing" | "completed" | "failed";
  extractSummary?: string | null;
}

export function useAttachmentStatusPoller<T extends AttachmentStatusItem>(
  initialAttachments: T[]
) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Pick<AttachmentStatusItem, "extractStatus" | "extractSummary">>
  >({});
  const attachments = useMemo(
    () =>
      initialAttachments.map((attachment) => {
        const override = statusOverrides[attachment.id];
        if (!override) {
          return attachment;
        }

        return {
          ...attachment,
          extractStatus: override.extractStatus ?? attachment.extractStatus,
          extractSummary: override.extractSummary ?? attachment.extractSummary,
        };
      }),
    [initialAttachments, statusOverrides]
  );
  const pendingAttachmentIds = useMemo(
    () =>
      attachments
        .filter(
          (attachment) =>
            attachment.extractStatus?.toLowerCase() === "pending" ||
            attachment.extractStatus?.toLowerCase() === "processing"
        )
        .map((attachment) => attachment.id)
        .sort(),
    [attachments]
  );
  const pendingSignature = pendingAttachmentIds.join("|");

  useEffect(() => {
    if (pendingAttachmentIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all(
        pendingAttachmentIds.map(async (attachmentId) => {
          const response = await fetch(`/api/ai/attachments/${attachmentId}`);
          const result = await response.json();
          if (!result.success) {
            return;
          }

          setStatusOverrides((current) => ({
            ...current,
            [attachmentId]: {
              extractStatus: result.data.extractStatus,
              extractSummary: result.data.extractSummary ?? current[attachmentId]?.extractSummary,
            },
          }));
        })
      );
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [pendingAttachmentIds, pendingSignature]);

  return attachments;
}
