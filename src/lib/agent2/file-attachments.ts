import type { FileUIPart } from "ai"
import type { Agent2UploadResult } from "@/types/agent2"

async function filePartToFile(file: FileUIPart): Promise<File> {
  const response = await fetch(file.url)
  if (!response.ok) {
    throw new Error(`无法读取附件：${file.filename ?? "未命名文件"}`)
  }

  const blob = await response.blob()
  return new File([blob], file.filename ?? "attachment", {
    type: blob.type || file.mediaType || "application/octet-stream",
  })
}

export async function uploadAgent2Files(
  files: FileUIPart[]
): Promise<Agent2UploadResult[]> {
  return Promise.all(
    files.map(async (file) => {
      const uploadFile = await filePartToFile(file)
      const formData = new FormData()
      formData.append("file", uploadFile)

      const response = await fetch("/api/agent2/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(
          payload?.error?.message ??
            `附件上传失败：${file.filename ?? "未命名文件"}`
        )
      }

      return payload.data as Agent2UploadResult
    })
  )
}

export function buildAttachmentMessageText(
  text: string,
  uploads: Agent2UploadResult[]
): string {
  const trimmedText = text.trim()
  if (uploads.length === 0) {
    return trimmedText
  }

  const attachmentContext = uploads
    .map(
      (upload) =>
        `### 附件：${upload.fileName}\n文件类型：${upload.fileType}\n内容：\n${upload.text}`
    )
    .join("\n\n")

  if (!trimmedText) {
    return `## 当前消息附件内容\n\n${attachmentContext}`
  }

  return `${trimmedText}\n\n## 当前消息附件内容\n\n${attachmentContext}`
}
