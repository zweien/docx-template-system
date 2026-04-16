"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const actionLabels: Record<string, string> = {
  LOGIN: "登录",
  LOGOUT: "退出登录",
  TEMPLATE_CREATE: "创建模板",
  TEMPLATE_UPDATE: "更新模板",
  TEMPLATE_DELETE: "删除模板",
  TEMPLATE_PUBLISH: "发布模板",
  DOCUMENT_GENERATE: "生成文档",
  BATCH_GENERATE: "批量生成",
  DATA_TABLE_CREATE: "创建数据表",
  DATA_TABLE_UPDATE: "更新数据表",
  DATA_TABLE_DELETE: "删除数据表",
  DATA_RECORD_CREATE: "创建数据记录",
  DATA_RECORD_UPDATE: "更新数据记录",
  DATA_RECORD_DELETE: "删除数据记录",
  DATA_IMPORT: "导入数据",
  DATA_EXPORT: "导出数据",
  USER_CREATE: "创建用户",
  USER_UPDATE: "更新用户",
  USER_DELETE: "删除用户",
  API_TOKEN_CREATE: "创建API令牌",
  API_TOKEN_REVOKE: "撤销API令牌",
  FORM_SHARE_CREATE: "创建表单分享",
  FORM_SHARE_DELETE: "删除表单分享",
  FORM_SUBMIT: "表单提交",
  DATA_TABLE_FIELD_UPDATE: "更新字段配置",
};

const actionOptions = Object.entries(actionLabels);

function getBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action.endsWith("_DELETE") || action === "API_TOKEN_REVOKE") return "destructive";
  if (action.endsWith("_CREATE")) return "default";
  if (action === "LOGIN" || action === "LOGOUT") return "secondary";
  return "outline";
}

const targetTypeLabels: Record<string, string> = {
  Template: "模板",
  Record: "文档",
  BatchGeneration: "批量生成",
  DataTable: "数据表",
  DataRecord: "数据记录",
  User: "用户",
  ApiToken: "API令牌",
};

interface AuditLogItem {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  success: boolean;
  data: {
    items: AuditLogItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchUser, setSearchUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterTargetType, setFilterTargetType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (searchUser) params.set("userId", searchUser);
      if (filterAction) params.set("action", filterAction);
      if (filterTargetType) params.set("targetType", filterTargetType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data: AuditLogResponse = await res.json();
      if (data.success) {
        setLogs(data.data.items);
        setTotalPages(data.data.totalPages);
        setTotal(data.data.total);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [page, searchUser, filterAction, filterTargetType, startDate, endDate]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
      return;
    }
    if (status === "authenticated") {
      load();
    }
  }, [status, session, router, load]);

  const resetFilters = () => {
    setSearchUser("");
    setFilterAction("");
    setFilterTargetType("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  if (status !== "authenticated" || session?.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">审计日志</h1>
      <p className="text-sm text-muted-foreground mb-6">
        共 {total} 条记录
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-48">
          <label className="text-xs text-muted-foreground">用户</label>
          <Input
            placeholder="搜索用户名/邮箱"
            value={searchUser}
            onChange={(e) => { setSearchUser(e.target.value); setPage(1); }}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-40">
          <label className="text-xs text-muted-foreground">操作类型</label>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">全部</option>
            {actionOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="text-xs text-muted-foreground">对象类型</label>
          <select
            value={filterTargetType}
            onChange={(e) => { setFilterTargetType(e.target.value); setPage(1); }}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">全部</option>
            {Object.entries(targetTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="text-xs text-muted-foreground">开始日期</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="h-8 text-sm"
          />
        </div>
        <div className="w-36">
          <label className="text-xs text-muted-foreground">结束日期</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters} className="h-8">
          <RotateCcw className="size-3 mr-1" /> 重置
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">时间</th>
                  <th className="text-left p-3 font-medium">操作人</th>
                  <th className="text-left p-3 font-medium">操作类型</th>
                  <th className="text-left p-3 font-medium">操作对象</th>
                  <th className="text-left p-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="border-t hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="p-3 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="p-3">
                        <div>{log.userName || "-"}</div>
                        <div className="text-xs text-muted-foreground">{log.userEmail || log.userId.slice(0, 8)}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={getBadgeVariant(log.action)}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {log.targetType ? (
                          <span>
                            <span className="text-muted-foreground">{targetTypeLabels[log.targetType] || log.targetType}</span>
                            {log.targetName && `: ${log.targetName}`}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="p-3 text-muted-foreground">{log.ipAddress || "-"}</td>
                    </tr>
                    {expandedId === log.id && log.detail && (
                      <tr key={`${log.id}-detail`} className="border-t bg-muted/20">
                        <td colSpan={5} className="p-3">
                          {log.action === "DATA_RECORD_UPDATE" && log.detail.changes ? (
                            <div className="space-y-1.5">
                              <div className="text-xs font-medium text-muted-foreground mb-1">字段变更</div>
                              {Object.entries(log.detail.changes as Record<string, { label?: string; oldValue?: unknown; newValue?: unknown }>).map(([key, change]) => (
                                <div key={key} className="text-xs flex items-center gap-2 flex-wrap">
                                  <span className="font-medium min-w-[80px]">{change.label ?? key}</span>
                                  <span className="text-destructive line-through opacity-70">{String(change.oldValue ?? "")}</span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="text-green-700 dark:text-green-400">{String(change.newValue ?? "")}</span>
                                </div>
                              ))}
                            </div>
                          ) : log.action === "DATA_RECORD_DELETE" && log.detail.fields ? (
                            <div className="space-y-1.5">
                              <div className="text-xs font-medium text-muted-foreground mb-1">已删除记录数据</div>
                              {Object.entries(log.detail.fields as Record<string, { label?: string; value?: unknown }>).map(([key, field]) => (
                                <div key={key} className="text-xs flex items-center gap-2">
                                  <span className="font-medium min-w-[80px]">{field.label ?? key}</span>
                                  <span className="text-muted-foreground">{String(field.value ?? "")}</span>
                                </div>
                              ))}
                            </div>
                          ) : log.action === "DATA_TABLE_FIELD_UPDATE" ? (
                            <div className="space-y-2">
                              {Array.isArray(log.detail.addedFields) && (log.detail.addedFields as { key: string; label: string; type: string }[]).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">新增字段</div>
                                  {(log.detail.addedFields as { key: string; label: string; type: string }[]).map((f) => (
                                    <div key={f.key} className="text-xs flex items-center gap-2">
                                      <span className="font-mono">{f.key}</span>
                                      <span className="text-muted-foreground">{f.label}</span>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">{f.type}</Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {Array.isArray(log.detail.removedFields) && (log.detail.removedFields as { key: string; label: string; type: string }[]).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-destructive mb-1">删除字段</div>
                                  {(log.detail.removedFields as { key: string; label: string; type: string }[]).map((f) => (
                                    <div key={f.key} className="text-xs flex items-center gap-2">
                                      <span className="font-mono">{f.key}</span>
                                      <span className="text-muted-foreground">{f.label}</span>
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">{f.type}</Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {Array.isArray(log.detail.changedFields) && (log.detail.changedFields as { key: string; oldLabel: string; newLabel: string; oldType: string; newType: string }[]).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">修改字段</div>
                                  {(log.detail.changedFields as { key: string; oldLabel: string; newLabel: string; oldType: string; newType: string }[]).map((f) => (
                                    <div key={f.key} className="text-xs flex flex-col gap-0.5">
                                      <span className="font-mono">{f.key}</span>
                                      {f.oldLabel !== f.newLabel && (
                                        <span className="text-muted-foreground">名称: <s>{f.oldLabel}</s> → {f.newLabel}</span>
                                      )}
                                      {f.oldType !== f.newType && (
                                        <span className="text-muted-foreground">类型: <s>{f.oldType}</s> → {f.newType}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                共 {String(log.detail.totalFields ?? "?")} 个字段
                              </div>
                            </div>
                          ) : (
                            <pre className="text-xs whitespace-pre-wrap break-all max-h-40 overflow-auto">
                              {JSON.stringify(log.detail, null, 2)}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      暂无日志记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                第 {page} / {totalPages} 页
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
