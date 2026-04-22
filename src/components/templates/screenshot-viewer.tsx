"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";

interface ScreenshotViewerProps {
  src: string;
  alt: string;
}

export function ScreenshotViewer({ src, alt }: ScreenshotViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen]);

  return (
    <>
      <div
        className="relative cursor-pointer overflow-hidden rounded-lg border"
        onClick={() => setIsOpen(true)}
      >
        <img src={src} alt={alt} className="h-40 w-full object-cover" />
        <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/20" />
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsOpen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
