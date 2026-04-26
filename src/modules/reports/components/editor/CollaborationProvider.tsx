"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useSession } from "next-auth/react";

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
  const { data: session } = useSession();
  const [state, setState] = useState<CollabState>({
    provider: null,
    doc: null,
    isConnected: false,
    getFragment: () => null,
  });

  useEffect(() => {
    // Only connect when there are collaborators (collaborative mode)
    if (!collaboratorIds || collaboratorIds.length === 0) return;

    const doc = new Y.Doc();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8070";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (session as any)?.accessToken;

    if (!token) return;

    const provider = new WebsocketProvider(
      wsUrl,
      `draft-${draftId}`,
      doc,
      {
        connect: false,
        params: { token },
      },
    );

    provider.on("status", ({ status }: { status: string }) => {
      setState((prev) => ({
        ...prev,
        isConnected: status === "connected",
      }));
    });

    provider.connect();

    const getFragment = (sectionId: string) => {
      if (!doc) return null;
      return doc.getXmlFragment(`section-${sectionId}`);
    };

    setState({
      provider,
      doc,
      isConnected: false,
      getFragment,
    });

    return () => {
      provider.destroy();
    };
  }, [draftId, collaboratorIds, session]);

  const value = useMemo(() => state, [state]);

  return (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  );
}

export function useCollaboration() {
  return useContext(CollabContext);
}
