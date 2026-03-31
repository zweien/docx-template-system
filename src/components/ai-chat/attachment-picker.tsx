"use client";

import { Paperclip } from "lucide-react";

interface UploadedAttachment {
  id: string;
  fileName: string;
  mimeType?: string;
  extractStatus?: "pending" | "processing" | "completed" | "failed";
}

interface AttachmentPickerProps {
  onUploaded: (attachment: UploadedAttachment) => void;
  disabled?: boolean;
}

async function parseResponseJson(response: Response) {
  if ("text" in response && typeof response.text === "function") {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as {
        success?: boolean;
        data?: UploadedAttachment;
        error?: { message?: string };
      };
    } catch {
      return null;
    }
  }

  if ("json" in response && typeof response.json === "function") {
    try {
      return (await response.json()) as {
        success?: boolean;
        data?: UploadedAttachment;
        error?: { message?: string };
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function AttachmentPicker({
  onUploaded,
  disabled = false,
}: AttachmentPickerProps) {
  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/ai/attachments", {
      method: "POST",
      body: formData,
    });
    const result = await parseResponseJson(response);
    if (response.ok && result?.success && result.data) {
      onUploaded(result.data);
    }

    event.target.value = "";
  }

  return (
    <div suppressHydrationWarning>
      <button
        type="button"
        suppressHydrationWarning
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
      >
        <Paperclip className="h-4 w-4" />
        <input
          aria-label="上传附件"
          suppressHydrationWarning
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleChange}
          disabled={disabled}
          type="file"
        />
      </button>
    </div>
  );
}
