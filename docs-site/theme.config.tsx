import type { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
      DOCX Template System
    </span>
  ),
  project: {
    link: 'https://github.com/zweien/docx-template-system',
  },
  docsRepositoryBase: 'https://github.com/zweien/docx-template-system/tree/master/docs-site',
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="DOCX Template System 文档" />
      <meta
        property="og:description"
        content="模板驱动的办公自动化系统 — DOCX 模板管理、动态表单、文档生成、报告撰写"
      />
      <link rel="icon" href="/favicon.ico" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    title: '本页目录',
    backToTop: true,
  },
  search: {
    placeholder: '搜索文档...',
  },
  editLink: {
    content: '在 GitHub 上编辑此页',
  },
  feedback: {
    content: '有问题？在 GitHub 上反馈',
  },
  footer: {
    content: (
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>MIT License</span>
        <span>DOCX Template System v0.11.0</span>
      </div>
    ),
  },
}

export default config
