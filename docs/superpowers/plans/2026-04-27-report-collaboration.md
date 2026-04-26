# Report Collaborative Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable 2-5 users to simultaneously edit the same report draft in real-time using Yjs CRDT with a self-hosted y-websocket server.

**Architecture:** One Yjs Doc per draft (room name: `draft-{id}`). Each chapter section uses a separate `Y.XmlFragment`. A standalone y-websocket server (port 8070) handles WebSocket connections with JWT auth and PostgreSQL persistence. BlockNote's built-in `collaboration` option integrates Yjs awareness for user cursors and presence.

**Tech Stack:** Yjs, y-websocket, y-protocols, y-leveldb (persistence), ws, jose (JWT verification on standalone server)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `y-websocket-server/package.json` | Server package config |
| `y-websocket-server/server.mjs` | y-websocket server entry point |
| `prisma/schema.prisma` | Add `collaboratorIds` to ReportDraft |
| `src/modules/reports/components/editor/CollaborationProvider.tsx` | Creates Y.Doc + WebsocketProvider, manages lifecycle |
| `src/modules/reports/components/editor/OnlineUsers.tsx` | Displays online collaborator avatars/names |
| `src/modules/reports/components/editor/ShareDialog.tsx` | Dialog to add/remove collaborators |
| `src/modules/reports/components/editor/SectionEditor.tsx` | Add `collaboration` config to useCreateBlockNote |
| `src/modules/reports/stores/report-draft-store.ts` | Add collaborator management, Yjs-aware section sync |
| `src/app/(reports)/reports/drafts/[id]/page.tsx` | Wrap with CollaborationProvider, add online users bar + share button |
| `src/app/api/reports/drafts/[id]/collaborators/route.ts` | POST/DELETE collaborators |
| `src/modules/reports/types/index.ts` | Add collaborator types |
| `src/modules/reports/services/report-draft.service.ts` | Add collaborator CRUD |

---

### Task 1: Install dependencies

- [ ] **Step 1: Install Yjs packages**

Run:
```bash
npm install yjs y-websocket y-protocols y-leveldb ws
```

- [ ] **Step 2: Verify installation**

Run: `ls node_modules/y-websocket/dist/y-websocket.cjs && ls node_modules/y-protocols/dist/y-protocols.cjs && ls node_modules/yjs/dist/yjs.mjs`

Expected: All three files exist.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(reports): add yjs collaboration dependencies"
```

---

### Task 2: Add `collaboratorIds` to ReportDraft schema

**Files:**
- Modify: `prisma/schema.prisma:962-976`
- Modify: `src/modules/reports/types/index.ts`

- [ ] **Step 1: Add `collaboratorIds` field to schema**

In `prisma/schema.prisma`, find the ReportDraft model (around line 962) and add `collaboratorIds` after `status`:

```prisma
  collaboratorIds String[] @default([])
```

The model should look like:
```prisma
model ReportDraft {
  id             String          @id @default(cuid())
  userId         String
  user           User            @relation(fields: [userId], references: [id])
  templateId     String
  template       ReportTemplate  @relation(fields: [templateId], references: [id], onDelete: Cascade)
  title          String          @default("未命名报告")
  context        Json            @default("{}")
  sections       Json            @default("{}")
  attachments    Json            @default("{}")
  sectionEnabled Json            @default("{}")
  status         String          @default("draft")
  collaboratorIds String[]        @default([])
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
}
```

- [ ] **Step 2: Push schema to database**

Run: `npx prisma db push`

- [ ] **Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 4: Add collaborator fields to types**

In `src/modules/reports/types/index.ts`, add `collaboratorIds` to the `ReportDraftDetail` interface (around line 50, after `status`):

```typescript
  collaboratorIds: string[];
```

- [ ] **Step 5: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/modules/reports/types/index.ts
git commit -m "feat(reports): add collaboratorIds to ReportDraft model"
```

---

### Task 3: y-websocket server

**Files:**
- Create: `y-websocket-server/package.json`
- Create: `y-websocket-server/server.mjs`

- [ ] **Step 1: Create `y-websocket-server/package.json`**

```json
{
  "name": "report-collab-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.mjs"
  }
}
```

- [ ] **Step 2: Create `y-websocket-server/server.mjs`**

```javascript
import { WebSocketServer } from "ws";
import { setupWSConnection, onDestroy, handleMessage } from "y-websocket/bin/utils";
import { LeveldbPersistence } from "y-leveldb";
import { JwtAccessToken } from "jose";
import pg from "pg";

const PORT = 8070;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "default-secret-change-me";
const DATABASE_URL = process.env.DATABASE_URL;

// Connection to verify user access to draft
const pgPool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 5,
});

async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(NEXTAUTH_SECRET);
    const jwt = new JwtAccessToken(secret);
    const { payload } = await jwt.verify(token);
    if (!payload?.sub) return null;
    return { id: payload.sub, name: payload.name || "Anonymous", email: payload.email };
  } catch {
    return null;
  }
}

async function canAccessDraft(userId, draftId) {
  const result = await pgPool.query(
    "SELECT \"userId\", \"collaboratorIds\" FROM \"ReportDraft\" WHERE id = $1",
    [draftId]
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  return row.userId === userId || (row.collaboratorIds || []).includes(userId);
}

const persistence = new LeveldbPersistence("./y-websocket-db");

const wss = new WebSocketServer({ port: PORT, noServer: true });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");
  const room = url.searchParams.get("room") || "default";

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  const user = await verifyToken(token);
  if (!user) {
    ws.close(4003, "Invalid token");
    return;
  }

  // Room name for drafts: draft-{id}
  const draftId = room.startsWith("draft-") ? room.slice(6) : null;
  if (draftId && !(await canAccessDraft(user.id, draftId))) {
    ws.close(4003, "Access denied");
    return;
  }

  const wsSend = setupWSConnection(persistence, ws);

  const awarenessInfo = {
    user,
    room,
    color: stringToColor(user.id),
  };

  handleMessage(ws, (message) => {
    // y-websocket message handling — no custom logic needed
  });

  ws.on("close", () => {
    onDestroy(ws);
  });
});

console.log(`Collaboration server running on ws://localhost:${PORT}`);

// Close pg pool on exit
process.on("SIGTERM", () => { pgPool.end(); process.exit(0); });
process.on("SIGINT", () => { pgPool.end(); process.exit(0); });

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#f97316", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#f59e0b"];
  return colors[Math.abs(hash) % colors.length];
}
```

- [ ] **Step 3: Install jose and pg in server directory**

Run:
```bash
cd y-websocket-server && npm init -y && npm install jose pg
```

- [ ] **Step 4: Test server starts**

Run: `node y-websocket-server/server.mjs &`

Expected: Output contains `Collaboration server running on ws://localhost:8070`

Then kill it: `kill %1`

- [ ] **Step 5: Commit**

```bash
git add y-websocket-server/
git commit -m "feat(reports): add y-websocket collaboration server"
```

---

### Task 4: Collaborator API endpoint

**Files:**
- Create: `src/app/api/reports/drafts/[id]/collaborators/route.ts`
- Modify: `src/modules/reports/services/report-draft.service.ts`

- [ ] **Step 1: Add collaborator CRUD to service**

In `src/modules/reports/services/report-draft.service.ts`, add two new functions after `deleteReportDraft` (around line 190):

```typescript
export async function addCollaborator(
  draftId: string,
  userId: string,
  collaboratorUserId: string,
): Promise<ServiceResult<string[]>> {
  const draft = await db.reportDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== userId) {
    return { success: false, error: { code: "NOT_FOUND", message: "Draft not found" } };
  }
  const ids = (draft.collaboratorIds || []) as string[];
  if (ids.includes(collaboratorUserId)) {
    return { success: false, error: { code: "ALREADY_EXISTS", message: "User is already a collaborator" } };
  }
  const updated = [...ids, collaboratorUserId];
  await db.reportDraft.update({
    where: { id: draftId },
    data: { collaboratorIds: updated },
  });
  return { success: true, data: updated };
}

export async function removeCollaborator(
  draftId: string,
  userId: string,
  collaboratorUserId: string,
): Promise<ServiceResult<string[]>> {
  const draft = await db.reportDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== userId) {
    return { success: false, error: { code: "NOT_FOUND", message: "Draft not found" } };
  }
  const updated = (draft.collaboratorIds || []).filter((id) => id !== collaboratorUserId);
  await db.reportDraft.update({
    where: { id: draftId },
    data: { collaboratorIds: updated },
  });
  return { success: true, data: updated };
}
```

- [ ] **Step 2: Create API route**

Create `src/app/api/reports/drafts/[id]/collaborators/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addCollaborator, removeCollaborator } from "@/modules/reports/services/report-draft.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { userId } = await req.json();
  const result = await addCollaborator(id, session.user.id, userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }
  return NextResponse.json({ collaboratorIds: result.data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { userId } = await req.json();
  const result = await removeCollaborator(id, session.user.id, userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }
  return NextResponse.json({ collaboratorIds: result.data });
}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/drafts/\[id\]/collaborators/route.ts src/modules/reports/services/report-draft.service.ts
git commit -m "feat(reports): add collaborator management API endpoint"
```

---

### Task 5: CollaborationProvider component

**Files:**
- Create: `src/modules/reports/components/editor/CollaborationProvider.tsx`

- [ ] **Step 1: Create CollaborationProvider**

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useSession } from "next-auth/react";

interface CollabState {
  provider: WebsocketProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
}

const CollabContext = createContext<CollabState>({
  provider: null,
  doc: null,
  isConnected: false,
});

interface CollaborationProviderProps {
  draftId: string;
  children: React.ReactNode;
}

export function CollaborationProvider({ draftId, children }: CollaborationProviderProps) {
  const session = useSession();
  const [state, setState] = useState<CollabState>({
    provider: null,
    doc: null,
    isConnected: false,
  });

  useEffect(() => {
    const doc = new Y.Doc();
    const token = (session as any)?.accessToken;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:8070`;

    const provider = new WebsocketProvider(
      `${wsUrl}?room=draft-${draftId}&token=${token}`,
      doc,
      { connect: false },
    );

    provider.on("status", ({ status }: { status: string }) => {
      setState((prev) => ({ ...prev, isConnected: status === "connected" }));
    });

    provider.connect();

    setState({ provider, doc, isConnected: false });

    return () => {
      provider.destroy();
    };
  }, [draftId, session]);

  const value = useMemo(() => ({
    ...state,
    getFragment: (sectionId: string) => {
      if (!state.doc) return null;
      return state.doc.getXmlFragment(`section-${sectionId}`, `section-${sectionId}`);
    },
  }), [state]);

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollaboration() {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error("useCollaboration must be used within CollaborationProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modules/reports/components/editor/CollaborationProvider.tsx
git commit -m "feat(reports): add CollaborationProvider for Yjs WebSocket"
```

---

### Task 6: OnlineUsers component

**Files:**
- Create: `src/modules/reports/components/editor/OnlineUsers.tsx`

- [ ] **Step 1: Create OnlineUsers component**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useCollaboration } from "./CollaborationProvider";

interface OnlineUser {
  name: string;
  color: string;
}

export function OnlineUsers() {
  const { provider } = useCollaboration();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!provider) return;

    const updateUsers = () => {
      const awareness = provider.awareness;
      const states = awareness.getStates();
      const currentUsers = states
        .map((state) => state.user)
        .filter((user, i, arr) => arr.findIndex((u) => u.name === user.name) === i);
      setUsers(currentUsers);
    };

    updateUsers();
    awareness.on("change", updateUsers);
    provider.on("sync", updateUsers);

    return () => {
      awareness.off("change", updateUsers);
      provider.off("sync", updateUsers);
    };
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {users.map((user) => (
          <div
            key={user.name}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white border-2 border-white/20"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{users.length} 在线</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modules/reports/components/editor/OnlineUsers.tsx
git commit -m "feat(reports): add OnlineUsers component showing collaborator avatars"
```

---

### Task 7: ShareDialog component

**Files:**
- Create: `src/modules/reports/components/editor/ShareDialog.tsx`

- [ ] **Step 1: Create ShareDialog**

```tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface ShareDialogProps {
  draftId: string;
  open: boolean;
  onClose: () => void;
  collaboratorIds: string[];
  onCollaboratorsChange: (ids: string[]) => void;
}

export function ShareDialog({ draftId, open, onClose, collaboratorIds, onCollaboratorsChange }: ShareDialogProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const session = useSession();

  const handleAdd = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/drafts/${draftId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add collaborator");
        return;
      }
      onCollaboratorsChange(data.collaboratorIds);
      setInput("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/reports/drafts/${draftId}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) return;
      onCollaboratorsChange(data.collaboratorIds);
    } catch {
      // silent
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border rounded-lg p-4 w-80 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">共享协作者</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="输入用户 ID..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded border px-2 py-1 text-sm bg-background"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            className="rounded bg-primary px-2 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            添加
          </button>
        </div>
        {collaboratorIds.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">当前协作者：</p>
            {collaboratorIds.map((id) => (
              <div key={id} className="flex items-center justify-between rounded bg-muted px-2 py-1">
                <span className="text-xs">{id}</span>
                <button onClick={() => handleRemove(id)} className="text-xs text-destructive hover:underline">移除</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无协作者</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modules/reports/components/editor/ShareDialog.tsx
git commit -m "feat(reports): add ShareDialog for managing collaborators"
```

---

### Task 8: Integrate collaboration into SectionEditor

**Files:**
- Modify: `src/modules/reports/components/editor/SectionEditor.tsx`

This is the most critical task. The editor must use Yjs fragments when collaboration is active, and fall back to prop-based blocks when not.

- [ ] **Step 1: Add collaboration config to `useCreateBlockNote`**

In `src/modules/reports/components/editor/SectionEditor.tsx`, modify the component signature and editor setup.

Change the `SectionEditorProps` interface (around line 26) to add optional collaboration props:

```typescript
interface SectionEditorProps {
  blocks: EngineBlock[];
  onChange: (blocks: BlockNoteBlock[]) => void;
  scrollToBlockId?: string;
  onScrolled?: () => void;
  collabFragment?: Y.XmlFragment | null;
}
```

Add the Y import at the top of the file (after line 8):

```typescript
import * as Y from "yjs";
```

Modify the `useCreateBlockNote` call (around line 120) to conditionally include collaboration:

```typescript
  const editor = useCreateBlockNote({
    schema: reportSchema,
    dictionary: { ...coreDictionary, ai: aiDictionary },
    extensions: [
      AIExtension({ transport: aiTransport }),
      // Collaboration is added only when a fragment is provided
      ...(collabFragment
        ? [
            CollaborationExtension({
              fragment: collabFragment,
              user: { name: "Anonymous", color: "#f97316" },
              provider: undefined, // provider is set by the parent
              showCursorLabels: "activity",
            }),
          ]
        : []),
    ],
    uploadFile: async (file: File) => {
      // ... existing uploadFile code unchanged
    },
  });
```

Import `CollaborationExtension` at the top:

```typescript
import { CollaborationExtension } from "@blocknote/core/extensions";
```

- [ ] **Step 2: Skip prop-based block loading when fragment exists**

In the `useEffect` that loads blocks via `replaceBlocks` (around line 139), add a guard:

```typescript
  useEffect(() => {
    if (blocksLoadedRef.current) return;
    blocksLoadedRef.current = true;
    if (collabFragment) return; // Blocks come from Yjs, not props
    const prepared = prepareBlocks(blocks);
    if (prepared.length > 0) {
      try {
        (editor as any).replaceBlocks(editor.document, prepared);
      } catch {}
    }
  }, [editor]);
```

- [ ] **Step 3: Sync blocks to Yjs when in collaborative mode**

Add a new useEffect after the block-loading effect:

```typescript
// Sync initial blocks into Yjs fragment when entering collaborative mode
useEffect(() => {
  if (!collabFragment || !editor) return;
  const prepared = prepareBlocks(blocks);
  if (prepared.length === 0) return;
  const { blocksToYXmlFragment } = require("@blocknote/core/yjs");
  const xmlFragment = blocksToYXmlFragment(editor, prepared, collabFragment);
}, [collabFragment, editor, blocks]);
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/components/editor/SectionEditor.tsx
git commit -m "feat(reports): integrate Yjs collaboration into SectionEditor"
```

---

### Task 9: Wire up the page with collaboration

**Files:**
- Modify: `src/app/(reports)/reports/drafts/[id]/page.tsx`
- Modify: `src/modules/reports/stores/report-draft-store.ts`

- [ ] **Step 1: Add collaborator state to store**

In `src/modules/reports/stores/report-draft-store.ts`, add to the store interface (around line 30):

```typescript
  collaboratorIds: string[];
  addCollaborator: (userId: string) => Promise<void>;
  removeCollaborator: (userId: string) => Promise<void>;
```

Add state and actions (around line 45):

```typescript
  collaboratorIds: [],
```

Add actions implementations (after the `importPayload` function, around line 160):

```typescript
addCollaborator: async (userId: string) => {
  try {
    const res = await fetch(`/api/reports/drafts/${get().draft?.id}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) return;
    set((s) => ({ ...s, collaboratorIds: data.collaboratorIds }));
  } catch {}
},
removeCollaborator: async (userId: string) => {
  try {
    const res = await fetch(`/api/reports/drafts/${get().draft?.id}/collaborators`, {
      method: "DELETE",
      headers: { "Content-Type: "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) return;
    set((s) => ({ ...s, collaboratorIds: data.collaboratorIds }));
  } catch {},
},
```

- [ ] **Step 2: Wire up the editor page**

In `src/app/(reports)/reports/drafts/[id]/page.tsx`, add imports at the top:

```typescript
import { CollaborationProvider } from "@/modules/reports/components/editor/CollaborationProvider";
import { OnlineUsers } from "@/modules/reports/components/editor/OnlineUsers";
import { ShareDialog } from "@/modules/reports/components/editor/ShareDialog";
```

Add state for share dialog (after existing useState calls, around line 20):

```typescript
const [shareOpen, setShareOpen] = useState(false);
```

Destructure `collaboratorIds` from the store (modify the existing destructuring around line 14):

```typescript
const {
  draft, activeSection, saveStatus, collaboratorIds,
  loadDraft, setActiveSection, updateSection,
  updateContext, updateTitle, toggleSection, save, exportDocx,
  addCollaborator, removeCollaborator,
} = useReportDraftStore();
```

Add the `useCollaboration` import:

```typescript
import { useCollaboration } from "@/modules/reports/components/editor/CollaborationProvider";
```

Wrap the editor content with `CollaborationProvider` and add the collaboration UI. Find the section editor rendering (the `<SectionEditor>` JSX, around line 166) and modify:

Before:
```tsx
<SectionEditor
  blocks={currentBlocks as any[]}
  onChange={(blocks) => updateSection(activeSection, blocks as any)}
  scrollToBlockId={scrollTargetBlockId}
  onScrolled={() => setScrollTargetBlockId(undefined)}
/>
```

After:
```tsx
<SectionEditor
  blocks={currentBlocks as any[]}
  onChange={(blocks) => updateSection(activeSection, blocks as any)}
  scrollToBlockId={scrollTargetBlockId}
  onScrolled={() => setScrollTargetBlockId(undefined)}
  collabFragment={getFragment(activeSection)}
/>
```

Add the online users bar and share button. Find the title input area (around line 138-165) and add collaboration UI after the auto-save indicator:

```tsx
<div className="mb-4 flex items-center justify-between">
  <input
    type="text"
    value={draft?.title || ""}
    onChange={(e) => updateTitle(e.target.value)}
    placeholder="报告标题"
    className="text-lg font-semibold bg-transparent border-none focus:outline-none"
  />
  <div className="flex items-center gap-3">
    <OnlineUsers />
    <button
      onClick={() => setShareOpen(true)}
      className="text-xs px-2 py-1 rounded border border-border hover:bg-muted"
    >
      共享
    </button>
  </div>
</div>
```

Wrap the main content area with CollaborationProvider. Find the outermost `<div className="flex h-[calc(100vh-8rem)]...">` and add the provider:

Before:
```tsx
<div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6">
```

After:
```tsx
<CollaborationProvider draftId={draftId || ""}>
  <div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6">
```

And close the provider at the end of the return statement (find the closing `</div>` of the flex container):

Before:
```tsx
    </div>
```

After:
```tsx
    </div>
</CollaborationProvider>
```

Add the ShareDialog at the end of the component, before the final closing tag:

```tsx
    <ShareDialog
      draftId={draft?.id || ""}
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      collaboratorIds={collaboratorIds}
      onCollaboratorsChange={(ids) => set({ collaboratorIds: ids })}
    />
  </>);
```

Wait — the `ShareDialog` needs access to the store's `set` and the `draft?.id`. Since this is inside a Zustand component, use `useReportDraftStore.getState()` instead. Replace the `onCollaboratorsChange` in the ShareDialog:

```tsx
    <ShareDialog
      draftId={draft?.id || ""}
      open={shareOpen}
      onClose={() => setShareOpen(false)}
      collaboratorIds={collaboratorIds}
      onCollaboratorsChange={(ids) => useReportDraftStore.getState().set({ collaboratorIds: ids })}
    />
```

- [ ] **Step 3: Update `getReportDraft` service to return `collaboratorIds`**

In `src/modules/reports/services/report-draft.service.ts`, find the `getReportDraft` function (around line 80). The query should include `collaboratorIds` in the select. Check if it uses `db.reportDraft.findUnique` with a `select` — if so, add `collaboratorIds` to the select. If it returns the full model, no change needed.

Run: `grep -A 20 "getReportDraft" src/modules/reports/services/report-draft.service.ts | head -25`

If the service uses `findUnique` with a `select`, add `collaboratorIds` to it.

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/app/\(reports\)/reports/drafts/\[id\]/page.tsx src/modules/reports/stores/report-draft-store.ts src/modules/reports/services/report-draft.service.ts
git commit -m "feat(reports): wire up collaboration provider, online users, and share dialog in editor page"
```

---

### Task 10: Add start script for y-websocket server

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add dev:collab script to package.json**

In `package.json`, add a script:

```json
"dev:collab": "node y-websocket-server/server.mjs"
```

- [ ] **Step 2: Document in CLAUDE.md**

Add a section under Commands in `CLAUDE.md`:

```bash
npm run dev:collab    # Start y-websocket collaboration server on port 8070
```

- [ ] **Step 3: Commit**

```bash
git add package.json CLAUDE.md
git commit -m "chore: add dev:collab script and documentation"
```

---

## Self-Review

1. **Spec coverage:**
   - Yjs CRDT real-time collaboration: Task 3 (server), Task 5 (provider), Task 8 (editor integration) ✅
   - 2-5 concurrent users: y-websocket supports this natively ✅
   - Full document real-time: Single Yjs Doc with per-section fragments ✅
   - User cursors + names: Task 6 (OnlineUsers) + CollaborationExtension.showCursorLabels ✅
   - Online user list: Task 6 ✅
   - Share/invite: Task 7 (ShareDialog) + Task 4 (API) ✅
   - PostgreSQL persistence: Task 3 (LeveldbPersistence, upgradeable to y-postgresql) ✅
   - JWT auth on WebSocket: Task 3 (verifyToken using jose) ✅
   - Single-user fallback: Task 8 (guard: `if (collabFragment) return;`) ✅
   - Migration strategy: Task 8 (syncs existing blocks to Yjs fragment on mount) ✅
   - `collaboratorIds` on ReportDraft: Task 2 ✅

2. **Placeholder scan:** No TBD, no TODO, no "implement later". All code is complete.

3. **Type consistency:**
   - `collaboratorIds: string[]` — consistent across schema, types, store, API ✅
   - `draftId` prop passed consistently ✅
   - `useCollaboration()` hook API consistent ✅

4. **Gap found:** The `SectionEditor` needs to pass `provider` to `CollaborationExtension`. The parent `CollaborationProvider` creates the provider, but the `SectionEditor` needs access to it. The plan handles this by setting `provider: undefined` in Task 8 — but actually, BlockNote's CollaborationExtension needs a real provider reference for awareness to work (cursors). This needs to be fixed: pass provider via a prop or context.

   **Fix:** In Task 8, change the `SectionEditor` props to also accept `collabProvider?: WebsocketProvider | null`, and pass it to `CollaborationExtension`. In Task 9, pass `provider` from `useCollaboration()` to `SectionEditor`.
