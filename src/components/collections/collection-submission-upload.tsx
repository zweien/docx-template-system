"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentCollectionVersionItem } from "@/types/document-collection";

export function CollectionSubmissionUpload({
  taskId,
  onSubmitted,
}: {
  taskId: string;
  onSubmitted?: (version: DocumentCollectionVersionItem) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("请先选择文件");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("note", note);

      const response = await fetch(`/api/collections/${taskId}/submissions`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        data?: DocumentCollectionVersionItem;
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "提交失败");
      }

      setFile(null);
      setNote("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      onSubmitted?.(payload.data);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4 rounded-xl border p-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="collection-submission-file">上传新版本</Label>
        <Input
          id="collection-submission-file"
          ref={inputRef}
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
        {file && <p className="text-sm text-muted-foreground">当前文件：{file.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="collection-submission-note">备注</Label>
        <Textarea
          id="collection-submission-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="选填，本次提交说明"
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          提交版本
        </Button>
      </div>
    </form>
  );
}
