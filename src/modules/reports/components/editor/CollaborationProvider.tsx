"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

interface CollabState {
  provider: WebsocketProvider | null;
  doc: Y.Doc | null;
  isConnected: boolean;
  getFragment: (sectionId: string) => Y.XmlFragment | null;
}

const CollabContext = createContext<CollabState>({
  provider: null,
  doc: null,
  isConnected: false,
  getFragment: () => null,
});

interface CollaborationProviderProps {
  draftId: string;
  collaboratorIds: string[];
  children: ReactNode;
}

export function CollaborationProvider({
  draftId,
  collaboratorIds,
  children,
}: CollaborationProviderProps) {
  const [state, setState] = useState<CollabState>({
    provider: null,
    doc: null,
    isConnected: false,
    getFragment: () => null,
  });

  useEffect(() => {
    const doc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8072";

    const destroyedRef = { current: false };
    let provider: WebsocketProvider | null = null;

    (async () => {
      try {
        const res = await fetch("/api/reports/collab-token");
        if (res.status !== 200 || destroyedRef.current) return;
        const data = await res.json();
        const token = data.token;
        if (!token || destroyedRef.current) return;

        provider = new WebsocketProvider(wsUrl, `draft-${draftId}`, doc, {
          connect: false,
          params: { token },
        });

        provider.on("status", ({ status }: { status: string }) => {
          if (!destroyedRef.current) {
            setState((prev) => ({ ...prev, isConnected: status === "connected" }));
          }
        });

        provider.connect();

        if (!destroyedRef.current) {
          setState({
            provider,
            doc,
            isConnected: false,
            getFragment: (sectionId: string) => doc.getXmlFragment(`section-${sectionId}`),
          });
        }
      } catch (err) {
        console.error("[collab] connection error:", err);
      }
    })();

    return () => {
      destroyedRef.current = true;
      provider?.destroy();
    };
  }, [draftId, collaboratorIds]);

  const value = useMemo(() => state, [state]);

  return (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  );
}

export function useCollaboration() {
  return useContext(CollabContext);
}
