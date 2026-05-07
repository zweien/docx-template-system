import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface DropZoneProps {
  accept: string[];
  onDrop: (paths: string[]) => void;
  multiple?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DropZone({ accept, onDrop, multiple = false, children, className = "" }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const multipleRef = useRef(multiple);
  multipleRef.current = multiple;

  useEffect(() => {
    let disposed = false;

    getCurrentWindow().onDragDropEvent((event) => {
      if (disposed) return;
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setIsDragging(true);
      } else if (event.payload.type === "drop") {
        setIsDragging(false);
        const paths = event.payload.paths.filter((p) => {
          const ext = "." + p.split(".").pop()?.toLowerCase();
          return acceptRef.current.some((a) => a.toLowerCase() === ext);
        });
        if (paths.length > 0) {
          onDropRef.current(multipleRef.current ? paths : paths.slice(0, 1));
        }
      } else {
        setIsDragging(false);
      }
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
      }
    });

    return () => { disposed = true; };
  }, []);

  return (
    <div className={`relative ${className}`}>
      {children}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-brand-bg/10 border-2 border-dashed border-brand-accent rounded-lg flex items-center justify-center">
          <div className="bg-panel/90 rounded-lg px-5 py-3 shadow-lg">
            <p className="text-[0.867rem] text-brand-accent font-medium">释放以添加文件</p>
            <p className="text-[0.667rem] text-text-quaternary mt-0.5">支持: {accept.join(", ")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
