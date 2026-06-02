"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, RefreshCw } from "lucide-react";

export default function DataPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const nocodbUrl = "http://localhost:8040";

  useEffect(() => {
    fetch("/api/nocodb/health")
      .then((r) => r.json())
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-lg font-semibold">NocoDB 未连接</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              请确认 NocoDB 服务已启动，并在环境变量中正确配置
              NOCODB_URL、NOCODB_API_TOKEN 和 NOCODB_BASE_ID。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">主数据表</span>
          <span className="text-xs text-muted-foreground">
            Powered by NocoDB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(nocodbUrl, "_blank")}
          >
            <ExternalLink className="mr-1 h-4 w-4" />
            在新窗口打开
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <iframe
          src={nocodbUrl}
          className="h-full w-full border-0"
          title="NocoDB 数据表"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
