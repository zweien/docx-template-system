# 论文数据增量补充导入设计

## 背景

已有 `scripts/import-papers.ts` 脚本完成了论文和作者数据的初始导入，但存在以下问题：

1. **字段不全**：论文表只映射了约 15 个字段，Excel 中 60+ 列有大量有价值的数据未导入（volume/issue/pages、影响因子、分区信息、会议信息、论文链接等）
2. **作者关系缺失**：`importRelationDetails` 只处理有 DOI 的论文，无 DOI 论文的作者关系未建立
3. **作者信息以纯文本存储**：`authors_cn` 和 `corresponding_authors` 作为文本导入了，但关系子表记录不完整

## 目标

在现有数据基础上增量补充：
- 补全论文表缺失的字段定义
- 用 Excel 数据覆盖/更新所有论文记录
- 为所有论文（含无 DOI）建立作者关系子表记录

## 数据源

Excel 文件：`/home/z/桌面/paper_author_db_ready_package.xlsx`
- `papers_final`：173 篇论文，60+ 列
- `paper_authors`：871 条论文-作者关系
- `authors_seed`：146 位作者（已导入，不变）

## 设计

### 1. 字段补充

在论文表现有字段基础上新增 17 个字段：

| 标签 | key | 类型 | SELECT 选项 | Excel 列 |
|-----|-----|------|------------|---------|
| 卷号 | volume | TEXT | - | volume |
| 期号 | issue | TEXT | - | issue |
| 页码 | pages | TEXT | - | pages |
| 影响因子 | impact_factor | TEXT | - | impact_factor |
| CCF分类 | ccf_category_std | SELECT | A, B, C, 无 | ccf_category_std |
| 中科院分区 | cas_partition_std | SELECT | 一区, 二区, 三区, 四区, 无 | cas_partition_std |
| JCR分区 | jcr_partition_std | SELECT | 一区, 二区, 三区, 四区, 无 | jcr_partition_std |
| SCI分区 | sci_partition_std | SELECT | 一区, 二区, 三区, 四区, 无 | sci_partition_std |
| 论文链接 | paper_link | TEXT | - | paper_link |
| 刊号/ISBN | issn_or_isbn | TEXT | - | issn_or_isbn |
| 会议中文名 | conference_name_cn | TEXT | - | conference_name_cn |
| 会议地点 | conference_location_cn | TEXT | - | conference_location_cn |
| 机构排名 | institution_rank_std | TEXT | - | institution_rank_std |
| 是否有问题 | issue_flag_std | SELECT | 是, 否 | issue_flag_std |
| 内部作者标记 | internal_author_flag_std | SELECT | 是, 否 | internal_author_flag_std |
| 审查表编号 | review_form_no | TEXT | - | review_form_no |
| 来源sheet | source_sheet | TEXT | - | source_sheet |

**重要**：`saveTableFieldsWithRelations` 使用全量语义——调用时 `fields` 参数必须包含论文表的**所有字段**（原有 16 个 + 17 个新增 = 33 个），不能只传新增字段。未包含在列表中的非反向字段会被删除。

### 2. 数据映射

完整映射表（Excel 列 → 系统字段 key）：

```
paper_title         → paper_title
paper_title_cn      → paper_title_cn
paper_type          → paper_type
group_name          → group_name
stat_year           → stat_year
publish_date        → publish_date
venue_name          → venue_name
doi_std             → doi
index_type_std      → index_type_std
publication_status_std → publication_status_std
archive_status_std  → archive_status_std
authors_cn          → authors_cn
corresponding_authors → corresponding_authors
completion_unit     → completion_unit
support_project     → support_project
volume              → volume          (新增)
issue               → issue           (新增)
pages               → pages           (新增)
impact_factor       → impact_factor   (新增)
ccf_category_std    → ccf_category_std (新增)
cas_partition_std   → cas_partition_std (新增)
jcr_partition_std   → jcr_partition_std (新增)
sci_partition_std   → sci_partition_std (新增)
paper_link          → paper_link       (新增)
issn_or_isbn        → issn_or_isbn     (新增)
conference_name_cn  → conference_name_cn (新增)
conference_location_cn → conference_location_cn (新增)
institution_rank_std → institution_rank_std (新增)
issue_flag_std      → issue_flag_std   (新增)
internal_author_flag_std → internal_author_flag_std (新增)
review_form_no      → review_form_no   (新增)
source_sheet        → source_sheet     (新增)
```

### 3. 数据更新策略

#### 3.1 论文数据

- 有 DOI 论文：用 `doi` 作为业务唯一键，`overwrite` 策略覆盖所有字段
- 无 DOI 论文：用 `paper_title` 作为业务唯一键，`overwrite` 策略覆盖所有字段
- 使用现有的 `importData` 服务，传入完整的字段映射

#### 3.2 作者关系

分两批处理 `paper_authors` sheet 中的 871 条关系记录：

**批次 1 - 有 DOI 的论文：**
- 论文匹配键：`doi_std` → `doi`
- 作者匹配键：`author_name_norm`
- 使用 `importRelationDetails` 服务

**批次 2 - 无 DOI 的论文：**
- 论文匹配键：`paper_title`（`paper_authors` sheet 中包含此列）
- 作者匹配键：`author_name_norm`
- 使用 `importRelationDetails` 服务，`sourceBusinessKeys` 传 `["paper_title"]`，`sourceMapping` 传 `{ paper_title: "paper_title" }`

**去重说明**：`importRelationDetails` 内部使用 `syncRelationSubtableValues`，对每个源记录采用全量同步语义——已有关系行按目标记录 ID 匹配并更新属性，新增关系行创建，不在本次数据中的已有关系行会被删除。因此不需要额外的去重预检查，但需要注意重复运行会重新同步所有关系。

### 4. 执行流程

```
Step 1: 连接数据库，获取现有表 ID
Step 2: 读取 Excel papers_final / paper_authors sheet
Step 3: 补充缺失字段定义 → saveTableFieldsWithRelations
Step 4: 重新获取完整字段列表
Step 5: 增量更新论文数据（有DOI + 无DOI）→ importData
Step 6: 补充作者关系（有DOI + 无DOI）→ importRelationDetails
```

### 5. 脚本改造

改造 `scripts/import-papers.ts`，增加 `--incremental` 模式：

- 不创建新表，直接获取已有表
- 字段定义合并：保留现有 + 添加缺失
- 数据更新使用 overwrite 策略
- 作者关系补充覆盖所有论文

### 6. 错误处理

- 字段补充失败：中止，人工检查
- 单条记录更新失败：记录错误，继续处理其余记录
- 关系匹配失败（找不到论文或作者）：记录到错误日志，跳过
- 最终输出完整统计：成功数、跳过数、错误详情
