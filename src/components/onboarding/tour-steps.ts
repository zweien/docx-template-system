import type { DriveStep } from "driver.js";

export const tourSteps: DriveStep[] = [
  {
    popover: {
      title: "欢迎使用 IDRL 填表系统 👋",
      description:
        "这是一个模板驱动的文档生成平台。接下来带你快速了解核心功能。",
      showButtons: ["next"],
      nextBtnText: "开始引导",
    },
  },
  {
    element: "#sidebar-nav",
    popover: {
      title: "侧边栏导航",
      description:
        "所有功能都从这里访问。导航按用途分组：\n\n• 模板与表单 — 日常最常用\n• 数据中心 — 数据管理\n• 报告中心 — 报告撰写",
      side: "right",
      align: "start",
    },
  },
  {
    element: "#header-search",
    popover: {
      title: "全局搜索",
      description: "点击搜索框或按 ⌘K 可以快速搜索模板、记录和功能。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#quick-actions",
    popover: {
      title: "快捷操作",
      description:
        "首页提供常用操作入口：\n\n• 我要填表 — 选择模板生成文档\n• 撰写报告 — 使用模板写报告\n• 数据表 — 管理结构化数据\n\n下方还有待办事项和最近使用的记录。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#user-nav",
    popover: {
      title: "个人设置",
      description: "这里可以切换深色/浅色主题、查看通知、管理个人账号。",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "#template-list",
    popover: {
      title: "模板库",
      description:
        "浏览所有可用模板。点击模板卡片即可进入表单填写页面。管理员可以上传和配置新模板。",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#form-area",
    popover: {
      title: "填写表单",
      description:
        "选择模板后会展示动态表单。根据提示填写各字段内容，系统会自动将数据填充到文档对应位置。",
      side: "left",
      align: "start",
    },
  },
  {
    element: "#submit-btn",
    popover: {
      title: "生成文档",
      description:
        "填写完成后点击「确认生成」按钮，系统将自动生成文档。你也可以先保存为草稿稍后继续。",
      side: "top",
      align: "end",
    },
  },
  {
    element: "#records-page",
    popover: {
      title: "生成记录",
      description:
        "所有生成过的文档都记录在这里。你可以查看状态、重新下载、或查看详情。",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "引导完成！🎉",
      description:
        "你已了解系统的基本使用方式。随时点击侧边栏底部的「新手引导」或右上角的「?」按钮可以重新查看。",
      showButtons: ["next"],
      nextBtnText: "开始使用",
    },
  },
];

// 跨页面步骤的索引：这些步骤需要先导航到对应页面
// 值为静态路由前缀或获取动态路由的函数
export const PAGE_STEP_MAP: Record<number, string | (() => Promise<string>)> = {
  5: "/generate",
  6: async () => {
    try {
      const res = await fetch("/api/templates?status=PUBLISHED&pageSize=1");
      const json = await res.json();
      const templates = json.data?.items ?? json.data ?? json;
      if (templates.length > 0) {
        return `/templates/${templates[0].id}/fill`;
      }
    } catch {
      // fallback: 跳过步骤 7、8，直接到步骤 9
    }
    return "/records";
  },
  8: "/records",
};
