"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { PublicFormRenderer } from "@/components/public/public-form-renderer";
import type { PublicFormConfig } from "@/lib/services/form-share.service";
import { Loader2 } from "lucide-react";

interface FormPageProps {
  params: Promise<{ token: string }>;
}

export default function PublicFormPage({ params }: FormPageProps) {
  const { token } = use(params);
  const [config, setConfig] = useState<PublicFormConfig | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/public/form/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setConfig(data.data);
        } else {
          setError(data.error?.message || "加载表单失败");
        }
      })
      .catch(() => {
        setError("网络错误，请稍后重试");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          加载表单...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="text-4xl">:(</div>
          <p className="text-lg font-medium">{error}</p>
          <p className="text-sm text-muted-foreground">
            该链接可能已失效或已过期
          </p>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 border-b">
          <h1 className="text-xl font-semibold">
            {config.formTitle || "未命名表单"}
          </h1>
          {config.formDescription && (
            <p className="mt-2 text-sm text-muted-foreground">
              {config.formDescription}
            </p>
          )}
        </div>
        <div className="p-6">
          <PublicFormRenderer config={config} token={token} />
        </div>
      </div>
      <div className="text-center mt-4 text-xs text-muted-foreground">
        由 docx-template-system 提供支持
      </div>
    </div>
  );
}
