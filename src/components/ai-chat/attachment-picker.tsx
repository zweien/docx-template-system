"use client";

import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    <div>
      <label className="inline-flex cursor-pointer">
        <input
          aria-label="上传附件"
          className="sr-only"
          onChange={handleChange}
          disabled={disabled}
          type="file"
        />
        <Button type="button" variant="outline" size="icon-sm" disabled={disabled}>
          <Paperclip className="h-4 w-4" />
        </Button>
      </label>
    </div>
  );
}
