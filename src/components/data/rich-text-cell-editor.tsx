"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useCallback } from "react";

interface RichTextCellEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
}

function extractPlainText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return extractTextFromDoc(parsed);
    } catch {
      return value;
    }
  }
  if (typeof value === "object" && value !== null) return extractTextFromDoc(value as Record<string, unknown>);
  return String(value);
}

function extractTextFromDoc(doc: Record<string, unknown>): string {
  if (!doc || !doc.content || !Array.isArray(doc.content)) return "";
  return (doc.content as Array<Record<string, unknown>>)
    .map((node) => extractTextFromNode(node))
    .join(" ")
    .trim();
}

function extractTextFromNode(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) || "";
  if (!node.content || !Array.isArray(node.content)) return "";
  return (node.content as Array<Record<string, unknown>>)
    .map((n) => extractTextFromNode(n))
    .join("");
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="h-7 w-7 p-0"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function RichTextToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 border-b p-1">
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextCellEditor({
  value,
  onChange,
}: RichTextCellEditorProps) {
  const [open, setOpen] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, UnderlineExt],
    content: parseContent(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  return (
    <>
      <div
        className="cursor-pointer truncate text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title={extractPlainText(value) || "点击编辑富文本"}
      >
        {extractPlainText(value) || "点击编辑"}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑富文本</DialogTitle>
          </DialogHeader>
          <div className="border rounded-md min-h-[200px]">
            <RichTextToolbar editor={editor} />
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none p-3 min-h-[160px] focus:outline-none"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setOpen(false)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function parseContent(value: unknown): Record<string, unknown> | string {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  return String(value);
}

export function RichTextPreview({ value }: { value: unknown }) {
  const plainText = extractPlainText(value);
  if (!plainText) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="text-sm truncate block max-w-[300px]" title={plainText}>
      {plainText.length > 100 ? plainText.slice(0, 100) + "..." : plainText}
    </span>
  );
}

export { extractPlainText };
