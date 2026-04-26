"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

interface MermaidPreviewProps {
  code: string;
}

export default function MermaidPreview({ code }: MermaidPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!code.trim()) {
      setError("Empty diagram");
      return;
    }

    let cancelled = false;
    const id = idRef.current;

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled) return;
        setError(null);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Invalid Mermaid syntax");
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-lg border border-neutral-700 bg-white p-4"
    />
  );
}
