import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card">
        <FileQuestion className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="mt-5 text-xl font-[510] tracking-tight text-foreground">
        页面未找到
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        你访问的页面不存在或已被移除。
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-[510] text-white transition-colors hover:bg-accent"
      >
        <Home className="h-4 w-4" />
        返回首页
      </Link>
    </div>
  );
}
