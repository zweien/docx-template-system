# Report Collaborative Editing Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable 2-5 users to simultaneously edit the same report draft in real-time using Yjs CRDT.

**Architecture:** One Yjs Doc per draft, with each chapter as a separate XmlFragment. A self-hosted y-websocket server (port 8070) manages WebSocket connections and PostgreSQL persistence. BlockNote's built-in `collaboration` config integrates Yjs provider and awareness protocol.

**Tech Stack:** Yjs, y-websocket, y-protocols, lib0 (Yjs persistence), @blocknote/core/yjs utilities

---

## Context

The reports module currently supports single-user editing only. Drafts are stored as JSON in `ReportDraft.sections` with last-write-wins semantics. The project already has PostgreSQL LISTEN/NOTIFY and SSE infrastructure (used by data tables), but the reports module has no real-time features.

BlockNote 0.49 has built-in Yjs collaboration support via the `collaboration` option in `useCreateBlockNote`.

## Design Decisions

- **Scope:** 2-5 concurrent users per draft
- **Conflict resolution:** Yjs CRDT (no manual conflict handling needed)
- **Collaboration granularity:** Full document real-time (all chapters, all positions)
- **Yjs Provider:** y-websocket self-hosted (leverages existing PostgreSQL)
- **Data model:** Extend existing `ReportDraft` with `collaboratorIds`

## Architecture

```
User A Browser ←WebSocket→ y-websocket Server (:8070) ←WebSocket→ User B Browser
                            ↕
                     PostgreSQL (Yjs doc persistence)
```

Each `ReportDraft` maps to one Yjs room identified by `draft-{id}`. The Yjs Doc contains one `XmlFragment` per chapter (`section-{sectionId}`). All editors connect to the same room and share awareness state (cursors, presence).

## Data Model

```prisma
model ReportDraft {
  // ... existing fields unchanged
  collaboratorIds String[] @default([])
}
```

**Access rules** (enforced at API and WebSocket level):
- `userId` (owner) has full read/write access
- Users in `collaboratorIds` have read/write access
- Others are denied

## y-websocket Server

Standalone Node.js process in `y-websocket-server/`:

- Port: 8070
- Depends: `y-websocket`, `y-protocols`, `ws`, `lib0`
- Auth: Validates NextAuth JWT on WebSocket handshake (`?token=...`)
- Persistence: PostgreSQL adapter using `y-postgresql` or custom `lib0.Level` with pg
- Room naming: `draft-{reportDraftId}`

Server entry point:
```typescript
// y-websocket-server/server.ts
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";
import { LeveldbPersistence } from "y-leveldb";
// or PostgreSQL persistence adapter

const server = new WebSocketServer({ port: 8070 });
server.on("connection", (ws, req) => {
  // 1. Validate JWT from req.url
  // 2. Check user has access to the draft (owner or collaborator)
  // 3. Setup y-websocket connection
});
```

## Frontend Integration

### CollaborationProvider Component

New component `src/modules/reports/components/editor/CollaborationProvider.tsx`:

- Creates `Y.Doc` and `WebsocketProvider` for the current draft
- Exposes `doc`, `provider`, `fragment` for each section
- Manages provider lifecycle (connect on mount, disconnect on unmount)
- Provides awareness user info (name, color from session)

```typescript
// Key props
interface CollaborationProviderProps {
  draftId: string;
  children: React.ReactNode;
}
```

### SectionEditor Changes

Add `collaboration` config to `useCreateBlockNote`:

```typescript
const editor = useCreateBlockNote({
  collaboration: {
    provider,
    fragment: doc.getXmlFragment(`section-${sectionId}`),
    user: { name: session.user.name, color: session.user.color },
    showCursorLabels: "activity",
  },
});
```

The editor no longer loads blocks from props. Instead, it receives blocks from the Yjs fragment. The `onChange` handler is no longer needed for syncing — Yjs handles that automatically. The `onChange` still fires for UI updates (e.g., outline panel refresh).

### Store Changes

`report-draft-store.ts` changes:
- Remove local `sections` state management (sections are now Yjs-driven)
- Keep `activeSection`, `context`, `title`, `sectionEnabled` as local state (not collaborative)
- Add `collaborators` state and `addCollaborator`/`removeCollaborator` actions
- The store becomes a thin layer over Yjs for section content

### Page Changes

`drafts/[id]/page.tsx`:
- Wrap editor in `CollaborationProvider`
- Add online users bar (avatars/names) below the title
- Add share button to invite collaborators

## API Changes

### New: Manage collaborators

```
POST /api/reports/drafts/[id]/collaborators
  Body: { userId: string }
  Response: { success: true, collaboratorIds: string[] }

DELETE /api/reports/drafts/[id]/collaborators
  Body: { userId: string }
  Response: { success: true, collaboratorIds: string[] }
```

### Modified: Draft create/read

- `POST /api/reports/drafts` returns `collaboratorIds` in response
- `GET /api/reports/drafts/[id]` includes `collaboratorIds`

## Migration Strategy

Existing single-user drafts continue to work unchanged. When a user opens a draft:
1. If no collaborators exist, editor works in single-user mode (no WebSocket connection)
2. When first collaborator is added, Yjs provider connects on next open

Initial content migration: When a draft first enters collaborative mode (first collaborator added), the existing `sections` JSON is loaded into the Yjs Doc fragments. This happens client-side on first connection.

## Offline & Reconnection

- y-websocket handles reconnection automatically
- Changes made offline are buffered and synced on reconnect
- If two users edit offline and reconnect, Yjs CRDT merges without conflicts

## Dependencies

```
y-websocket
y-protocols
y-postgresql (or y-leveldb for simpler setup)
ws
```

## What is NOT included

- Version history / undo across sessions (Yjs undo is per-session)
- Comments / threads on blocks (future feature)
- Fine-grained permissions (editor vs viewer per section)
- Mobile support
