"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface TokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isRevoked: boolean;
}

export function ApiTokensTab() {
  const { data: _session } = useSession();
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiresIn, setExpiresIn] = useState<string>("never");

  // Show token dialog state
  const [showTokenOpen, setShowTokenOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState("");
  const [_revealingTokenId, setRevealingTokenId] = useState<string | null>(null);

  // Created token dialog
  const [createdTokenOpen, setCreatedTokenOpen] = useState(false);
  const [newToken, setNewToken] = useState("");

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/api-tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens);
      }
    } catch {
      toast.error("获取 Token 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleCreate = async () => {
    if (!tokenName.trim()) {
      toast.error("请输入 Token 名称");
      return;
    }

    try {
      const expiresInDays =
        expiresIn === "never"
          ? null
          : expiresIn === "30"
            ? 30
            : expiresIn === "90"
              ? 90
              : null;

      const res = await fetch("/api/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName.trim(),
          expiresInDays,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setCreatedTokenOpen(true);
        setCreateOpen(false);
        setTokenName("");
        setExpiresIn("never");
        fetchTokens();
        toast.success("Token 创建成功");
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建 Token 失败");
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("确定要撤销此 Token 吗？撤销后使用此 Token 的请求将被拒绝。")) return;

    try {
      const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Token 已撤销");
        fetchTokens();
      } else {
        const data = await res.json();
        toast.error(data.error || "撤销失败");
      }
    } catch {
      toast.error("撤销 Token 失败");
    }
  };

  const handleRevealToken = async (id: string) => {
    try {
      const res = await fetch(`/api/api-tokens/${id}`);
      if (res.ok) {
        const data = await res.json();
        setRevealedToken(data.token);
        setRevealingTokenId(id);
        setShowTokenOpen(true);
      } else {
        toast.error("获取 Token 失败");
      }
    } catch {
      toast.error("获取 Token 失败");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("zh-CN");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">API Token</h2>
          <p className="text-sm text-muted-foreground">
            管理 API Token，允许外部系统通过 Token 访问系统数据。
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            创建 Token
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建 API Token</DialogTitle>
              <DialogDescription>
                创建后可查看完整 Token。Token 继承你的账户权限。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">名称</label>
                <Input
                  placeholder="例如：CRM 集成"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">过期时间</label>
                <Select value={expiresIn} onValueChange={(value) => setExpiresIn(value ?? "never")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">永不过期</SelectItem>
                    <SelectItem value="30">30 天</SelectItem>
                    <SelectItem value="90">90 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Created token display dialog */}
        <Dialog open={createdTokenOpen} onOpenChange={setCreatedTokenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token 创建成功</DialogTitle>
              <DialogDescription>
                请复制此 Token。你可以随时在 Token 管理页面再次查看。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                  {newToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newToken)}
                >
                  复制
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setCreatedTokenOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reveal token dialog */}
        <Dialog open={showTokenOpen} onOpenChange={setShowTokenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Token 明文</DialogTitle>
              <DialogDescription>
                请妥善保管此 Token，不要泄露给未授权人员。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                  {revealedToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(revealedToken)}
                >
                  复制
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTokenOpen(false)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          还没有创建任何 Token
        </div>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 text-sm font-medium">名称</th>
                <th className="text-left p-3 text-sm font-medium">Token</th>
                <th className="text-left p-3 text-sm font-medium">过期时间</th>
                <th className="text-left p-3 text-sm font-medium">最后使用</th>
                <th className="text-left p-3 text-sm font-medium">状态</th>
                <th className="text-right p-3 text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b last:border-0">
                  <td className="p-3 text-sm">{token.name}</td>
                  <td className="p-3 text-sm font-mono text-muted-foreground">
                    {token.tokenPrefix}...
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(token.expiresAt)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(token.lastUsedAt)}
                  </td>
                  <td className="p-3 text-sm">
                    {token.isRevoked ? (
                      <span className="text-destructive">已撤销</span>
                    ) : (
                      <span className="text-green-600">活跃</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!token.isRevoked && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevealToken(token.id)}
                          >
                            查看
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleRevoke(token.id)}
                          >
                            撤销
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
