# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.6.8](https://github.com/zweien/docx-template-system/compare/v0.6.7...v0.6.8) (2026-04-23)


### Features

* add automation engine runtime and management ui ([#136](https://github.com/zweien/docx-template-system/issues/136)) ([1ed5787](https://github.com/zweien/docx-template-system/commit/1ed578711b9c13b75b66603d8cd63b199209faf1))
* **automation:** add realtime run updates ([977f282](https://github.com/zweien/docx-template-system/commit/977f282e3ef6d85bc4ef3e61c4ea4641a3d2f464))
* **automation:** support related-record update action ([812a040](https://github.com/zweien/docx-template-system/commit/812a0409a44582f6f6094fd42cb517cdd14314bc))
* **forms:** AI 填充助手支持停止回答 ([50b7da8](https://github.com/zweien/docx-template-system/commit/50b7da8fb6dfa5c960cf19d64a7267491ccc2aee))
* **forms:** 支持 AI 填充助手增量自动填表 ([3b76cd2](https://github.com/zweien/docx-template-system/commit/3b76cd29356a9f20547e6a15aac02f0a82c240eb))


### Bug Fixes

* **agent2:** clear completed stream status ([#145](https://github.com/zweien/docx-template-system/issues/145)) ([ccee289](https://github.com/zweien/docx-template-system/commit/ccee289a6fc390586b14e8fd4729e2566e62ea14))
* **data:** apply explicit grid row heights ([#144](https://github.com/zweien/docx-template-system/issues/144)) ([5631d70](https://github.com/zweien/docx-template-system/commit/5631d70acfdd325ac421e77479a6661b88ac6a2b))
* **data:** improve calendar view record creation ([dc30e05](https://github.com/zweien/docx-template-system/commit/dc30e05588a786a5b17c105b750489329bac0129))

## [0.6.7](https://github.com/zweien/docx-template-system/compare/v0.6.6...v0.6.7) (2026-04-21)

## [0.6.2](https://github.com/zweien/docx-template-system/compare/v0.6.1...v0.6.2) (2026-04-19)


### Bug Fixes

* **import:** remove duplicate const num declaration in DURATION parsing ([6016e32](https://github.com/zweien/docx-template-system/commit/6016e326f6267bdee9040b545b8aa05a921bcb79))
* **theme:** improve light-mode contrast for detail pages and destructive buttons ([aaad132](https://github.com/zweien/docx-template-system/commit/aaad132fc54f2de9ccf6ea9163a099c501f9917d))
* **theme:** improve templates page readability in light mode ([2b91af4](https://github.com/zweien/docx-template-system/commit/2b91af45c597f335c46d83705649402717b1ed9e))
* **theme:** restore light-mode readability for records and table text ([ea73cbf](https://github.com/zweien/docx-template-system/commit/ea73cbfee7a161c90d0634c291cedd34000f30cd))

## [0.6.1](https://github.com/zweien/docx-template-system/compare/v0.6.0...v0.6.1) (2026-04-19)


### Features

* **nav:** add shared navigation schema, matcher and tests ([e85c8d1](https://github.com/zweien/docx-template-system/commit/e85c8d1f73ca314ec8ddc371f58f8df15a817f17))
* **nav:** add shared navigation state hook with safe persistence ([6a02dba](https://github.com/zweien/docx-template-system/commit/6a02dba3d9dddcfb0a9748436ca4abbe9f22c011))


### Bug Fixes

* **data:** prevent find-replace render loop on stable query ([8788a8d](https://github.com/zweien/docx-template-system/commit/8788a8d5bd373605b71f5a1ee731be4504ecf406))
* **drafts:** remove nested interactive elements and stabilize trigger usage ([656809f](https://github.com/zweien/docx-template-system/commit/656809f15c61b7fb65e2becfca3c5f2774595561))
* **ui:** stabilize nav interactions and improve dashboard light-theme contrast ([0908df6](https://github.com/zweien/docx-template-system/commit/0908df6377b75637d68a60ed9fb0b76018570ba0))

## [0.6.0](https://github.com/zweien/docx-template-system/compare/v0.5.4...v0.6.0) (2026-04-19)


### Features

* **data-table:** 新增 ROLLUP 汇总字段类型 ([#88](https://github.com/zweien/docx-template-system/issues/88)) ([8f7b44b](https://github.com/zweien/docx-template-system/commit/8f7b44beceb9857f6c0a2b821833e8abf5d3c073))
* **timeline:** 甘特图增强（依赖连线/拖拽改期/里程碑/缩放平移）([#119](https://github.com/zweien/docx-template-system/issues/119)) ([#132](https://github.com/zweien/docx-template-system/issues/132)) ([ecf09fd](https://github.com/zweien/docx-template-system/commit/ecf09fd5432aa5b1316d3bc579af1f82206368ba))


### Bug Fixes

* 评论增删改后实时刷新单元格评论标识 ([e99a38a](https://github.com/zweien/docx-template-system/commit/e99a38a1ae9a07cb673c657041f96171b4e13b1f))
* 为 CommentPanel 添加 @提及自动补全功能 ([a860388](https://github.com/zweien/docx-template-system/commit/a8603888a125f238940f64c06244ba50b4efc4a9))
* 修复时长编辑器 hh:mm 解析错误 + 评分编辑器缺少 onBlur ([a27a5b8](https://github.com/zweien/docx-template-system/commit/a27a5b800f9518c73c714efcafcabd6c1d6168d7))
* 移动端详情抽屉导航箭头被关闭按钮遮挡 ([2ccd33f](https://github.com/zweien/docx-template-system/commit/2ccd33f9113598c4749a9147f1beab555dedc3a2))
* **data-table:** 修复货币字段小数位保存不生效 ([#130](https://github.com/zweien/docx-template-system/issues/130)) ([d1cef23](https://github.com/zweien/docx-template-system/commit/d1cef236676ba405dee7909be09b8ef6a73871cc))

## [0.5.4](https://github.com/zweien/docx-template-system/compare/v0.5.3...v0.5.4) (2026-04-16)


### Bug Fixes

* code review 修复 — backfill 性能、查找替换安全性、LOOKUP 边界 ([62fd2b7](https://github.com/zweien/docx-template-system/commit/62fd2b74da1e75bedeace73f9bd1e951700912cf))

## [0.5.3](https://github.com/zweien/docx-template-system/compare/v0.5.2...v0.5.3) (2026-04-16)

## [0.5.2](https://github.com/zweien/docx-template-system/compare/v0.5.1...v0.5.2) (2026-04-16)


### Bug Fixes

* **agent2:** PersistableMessage 类型添加 id 字段修复构建失败 ([2a1ed03](https://github.com/zweien/docx-template-system/commit/2a1ed03e5160d6b8be4630ddb2262c6731895650))

## [0.5.1](https://github.com/zweien/docx-template-system/compare/v0.5.0...v0.5.1) (2026-04-16)


### Features

* **audit:** 字段配置变更写入审计日志 ([ff455c1](https://github.com/zweien/docx-template-system/commit/ff455c1ab73056ac6c61e19527ac407fefea2d18))
* **data-table:** 编辑页面 RELATION 变更后立即刷新 COUNT/LOOKUP ([9b3c9a6](https://github.com/zweien/docx-template-system/commit/9b3c9a61d4c0f19540833156c4442c9bc35fe518))
* **data-table:** 新增 COUNT 字段类型，支持统计关联记录数量 ([d6e2fc4](https://github.com/zweien/docx-template-system/commit/d6e2fc40e2efec90589f438b380b677a297815e5))
* **data-table:** 新增 LOOKUP 字段类型 ([dcb9eda](https://github.com/zweien/docx-template-system/commit/dcb9eda051693d19ad25bd8dd0d0a2fd1738ba90))


### Bug Fixes

* **data-table:** 编辑 RELATION 字段后刷新 COUNT/LOOKUP 计算值 ([ba69132](https://github.com/zweien/docx-template-system/commit/ba691323026baef141f80dbed66f90a3f0f1bf33))
* **data-table:** 编辑页面 RELATION 变更后本地计算 COUNT/LOOKUP，不持久化 ([ca82125](https://github.com/zweien/docx-template-system/commit/ca821250eceac902a628820aad290ce811983402))
* **data-table:** 编辑页面 RelationSelect 搜索不完整，改用 relation-options API ([cd30bd4](https://github.com/zweien/docx-template-system/commit/cd30bd44a9f1ada5e204f7507f06dcbed83d21bb))
* **data-table:** 编辑页面取消不应保存数据，移除 RELATION onChange 实时写入 ([3b78d92](https://github.com/zweien/docx-template-system/commit/3b78d921f7ef54e60dc11cb7f87d6459703172f7))
* **data-table:** COUNT/LOOKUP 只读计算字段不参与数据分割 ([8d614a2](https://github.com/zweien/docx-template-system/commit/8d614a2023a2addef87d8e78bcca5c4ae8d71ddb))
* **data-table:** COUNT/LOOKUP 字段表单验证和后端验证修复 ([95aa8cd](https://github.com/zweien/docx-template-system/commit/95aa8cd478dbd282b37766109ef9f9f690f8580e))
* **data-table:** RELATION 单元格编辑器下拉列表被 overflow-hidden 裁掉 ([d9b9cd4](https://github.com/zweien/docx-template-system/commit/d9b9cd4e6519e027e530af24174337b97cdc1f74))
* **data-table:** RELATION 下拉用 createPortal 渲染到 body 避免被表格行遮挡 ([867f384](https://github.com/zweien/docx-template-system/commit/867f3841d1aff1abd827c6eee05379b30c04c3f4))
* **data-table:** RELATION 选项下拉搜索不完整 ([39d9684](https://github.com/zweien/docx-template-system/commit/39d9684bd508f2a425226ba51786f59f64b24d6a))
* **data-table:** RELATION 字段搜索显示值 ([14493bf](https://github.com/zweien/docx-template-system/commit/14493bfea391a1fd9fbf141c26ec08e9ebbc2b1a)), closes [#12](https://github.com/zweien/docx-template-system/issues/12)
* **data-table:** RELATION 字段值同时兼容 display/displayValue 属性 ([8b03184](https://github.com/zweien/docx-template-system/commit/8b0318432f3b60491e288f1129d1933318952675))
* **data-table:** updateRecord 路径也刷新 COUNT/LOOKUP 计算值 ([3f789ee](https://github.com/zweien/docx-template-system/commit/3f789ee44a89042129f6e322c706fdece32827a9))
* **lookup:** 目标表字段动态加载 ([24146f7](https://github.com/zweien/docx-template-system/commit/24146f74e228c4ab0fcfc01760e11a11d62918d7))
* **lookup:** 修复 RELATION 源 LOOKUP 字段值计算失败 ([173f715](https://github.com/zweien/docx-template-system/commit/173f7154f1248399683fa6c18aa3e141d5cc32b5))
* review 修复 — 移除 COUNT font-mono、回填失败 alert、审计日志字段变更对比 ([ce3c7f7](https://github.com/zweien/docx-template-system/commit/ce3c7f7f62e20f110446012b681e96b8023d6a35))

## [0.5.0](https://github.com/zweien/docx-template-system/compare/v0.4.0...v0.5.0) (2026-04-16)


### Features

* **data-table:** 关联字段搜索选择器 ([#75](https://github.com/zweien/docx-template-system/issues/75)) ([f644b9a](https://github.com/zweien/docx-template-system/commit/f644b9a64a5cf3d119f815e22509859f635195b6))
* **data-table:** Select/MultiSelect 字段颜色标签 ([#77](https://github.com/zweien/docx-template-system/issues/77)) ([6c0cbf9](https://github.com/zweien/docx-template-system/commit/6c0cbf93b5d611e99686e1b5d7d9624a5d70f591))
* **fill-assist:** AI 填充助手增加模型选择功能 ([3fb44ba](https://github.com/zweien/docx-template-system/commit/3fb44ba755439c0eb8e723eb95968d013ba8cd59))
* **formula:** 增强函数说明展示与可扩展性 ([#84](https://github.com/zweien/docx-template-system/issues/84)) ([#85](https://github.com/zweien/docx-template-system/issues/85)) ([ec72783](https://github.com/zweien/docx-template-system/commit/ec72783732007ef5bb67d31f6a6a9a2f897f8081))


### Bug Fixes

* **data-table:** 关联字段选择后本地即时显示名称 ([255e1f9](https://github.com/zweien/docx-template-system/commit/255e1f9a0dee6321d14606302208c6eb33c903f5))
* **data-table:** 深色模式下彩色标签文字不可见 ([46fdf3d](https://github.com/zweien/docx-template-system/commit/46fdf3d1eb79e1906a843b500193b2e617496d90))

## [0.4.0](https://github.com/zweien/docx-template-system/compare/v0.3.10...v0.4.0) (2026-04-14)


### Features

* 数据表定期备份功能 ([bc09b0f](https://github.com/zweien/docx-template-system/commit/bc09b0fabfeed676eb36319c05e4c4ccfbd493f2)), closes [#27](https://github.com/zweien/docx-template-system/issues/27)
* 添加数据表备份恢复功能 ([3d061fd](https://github.com/zweien/docx-template-system/commit/3d061fd3f7e84fd078a6656ce8f41c745da687f6))
* **agent2:** 前端确认工具自动展开 + 详情卡片渲染 ([5320682](https://github.com/zweien/docx-template-system/commit/53206821d0a7c587899f40d2c515b8530794799f))
* **agent2:** 确认后自动发送工具结果，AI 继续生成执行结果回复 ([eaca192](https://github.com/zweien/docx-template-system/commit/eaca1928c45812e244c504c9ff50ec8229b477f4))
* **agent2:** 添加 DOI 查询服务（Crossref API） ([3c7ce3b](https://github.com/zweien/docx-template-system/commit/3c7ce3b92356bade478c29c55d2db5ebbe6fb24a))
* **agent2:** 添加 importPaper 到确认机制和执行器 ([f81244e](https://github.com/zweien/docx-template-system/commit/f81244e5935b7fa4c0f4a7742067a1786b7dc6ba))
* **agent2:** 添加论文导入执行器（作者匹配+关联建立） ([57a1c8c](https://github.com/zweien/docx-template-system/commit/57a1c8ce2ad0ec1f00f5ca1d955e179dfc782cc4))
* **agent2:** 添加确认工具详情预取函数 fetchDetailPreview ([0ff8355](https://github.com/zweien/docx-template-system/commit/0ff8355a92213d13587ae7a703d867bff9a74de8))
* **agent2:** 系统提示增加论文导入能力说明 ([5e04172](https://github.com/zweien/docx-template-system/commit/5e04172de54de522837c34d8e0b9ee7b6d5e4519))
* **agent2:** 注册论文导入工具（parsePaperText, fetchPaperByDOI, importPaper） ([8cf3106](https://github.com/zweien/docx-template-system/commit/8cf31069bd911a6f3392b9dbbb4a169a4d93f65a))
* **agent2:** restrict write tools to admin users only ([7ea4290](https://github.com/zweien/docx-template-system/commit/7ea42909747d875cf153febc8b4d7957576bf096))
* **agent2:** stopWhen 检测 _needsConfirm 停止 + 修复移动端选择类型 ([2051aa4](https://github.com/zweien/docx-template-system/commit/2051aa45e61ff34483a609b6fc24b31515bb9c32))
* **agent2:** system prompt 添加确认流程和删除操作指导 ([2b50044](https://github.com/zweien/docx-template-system/commit/2b50044b123b93f751217baf615ff8fcc7dbf19d))
* **agent2:** wrapConfirm 返回 detailPreview 字段 ([0efdb66](https://github.com/zweien/docx-template-system/commit/0efdb6632a9ed14b492e271dca78d31989854946))
* AI 助手对话建议支持管理员自定义配置 ([9cd88cd](https://github.com/zweien/docx-template-system/commit/9cd88cd9474a77d4d9e3329e2e91edcd71af20ed)), closes [#33](https://github.com/zweien/docx-template-system/issues/33)
* **data-table:** 多单元格区域选择和批量复制粘贴 ([f166db2](https://github.com/zweien/docx-template-system/commit/f166db23a0013cfe84db34fa1966ad5f049d9952)), closes [#47](https://github.com/zweien/docx-template-system/issues/47)
* **data-table:** 分页支持自定义每页显示条目数 ([2da9df8](https://github.com/zweien/docx-template-system/commit/2da9df8d76d0fc057553e3623bf8041228cb96c4)), closes [#59](https://github.com/zweien/docx-template-system/issues/59)
* **data-table:** 分页组件增强，支持首页/末页/页码跳转 ([d1bede6](https://github.com/zweien/docx-template-system/commit/d1bede6690dbe5fd95c30128cece3ef5cde021a4)), closes [#57](https://github.com/zweien/docx-template-system/issues/57)
* **data-table:** 记录级别变更历史审计 ([62cc0cd](https://github.com/zweien/docx-template-system/commit/62cc0cd877e70eadf51f06809afa28301c07480f)), closes [#52](https://github.com/zweien/docx-template-system/issues/52)
* **data-table:** 扩展筛选运算符支持更多过滤条件 ([a06e827](https://github.com/zweien/docx-template-system/commit/a06e82707dc0bfafa9e58b2d7550d96dd0f4225b)), closes [#51](https://github.com/zweien/docx-template-system/issues/51)
* **data-table:** 网格底部快捷新建行入口 ([e859945](https://github.com/zweien/docx-template-system/commit/e859945ea96cadbad5528f636c97ed4dd4b1d8ea)), closes [#45](https://github.com/zweien/docx-template-system/issues/45)
* **data-table:** 新增 Shift+Enter 插入行、Ctrl+X 剪切、Ctrl+D 复制行快捷键 ([#72](https://github.com/zweien/docx-template-system/issues/72)) ([2374da1](https://github.com/zweien/docx-template-system/commit/2374da164faa40114330cf03d5d14590c212ac89)), closes [#69](https://github.com/zweien/docx-template-system/issues/69)
* **data-table:** 虚拟滚动替代分页，全量加载+自定义行窗口化 ([703534a](https://github.com/zweien/docx-template-system/commit/703534a0cd873885ffa8599d847fe6643355c911)), closes [#46](https://github.com/zweien/docx-template-system/issues/46)
* **data-table:** 支持单元格拖拽自动填充（fill handle） ([43483d1](https://github.com/zweien/docx-template-system/commit/43483d1538d5cf4e6ecf8f60ce891de6ccbcfbde)), closes [#50](https://github.com/zweien/docx-template-system/issues/50)
* **data-table:** 支持行高调整四档（紧凑/标准/宽松/超高） ([f6d4e1c](https://github.com/zweien/docx-template-system/commit/f6d4e1c91ab1963ac6c6702bbcb1e7be2f1fdda8)), closes [#49](https://github.com/zweien/docx-template-system/issues/49)
* **data-table:** Ctrl+方向键跳转边缘、Ctrl+; 填入当前日期 ([#73](https://github.com/zweien/docx-template-system/issues/73)) ([b97e913](https://github.com/zweien/docx-template-system/commit/b97e9132201f47168aea48621a1c7a99de3dff2d)), closes [#70](https://github.com/zweien/docx-template-system/issues/70)
* **data-table:** Ctrl+F 查找替换栏 ([2242d0e](https://github.com/zweien/docx-template-system/commit/2242d0e85a6180576683b01acd5c4c67264fc5ca)), closes [#71](https://github.com/zweien/docx-template-system/issues/71)
* **data-table:** Shift+Space 快捷键打开记录详情抽屉 ([c91c43a](https://github.com/zweien/docx-template-system/commit/c91c43abadba9a83b39d78de9f127956b147cefb)), closes [#48](https://github.com/zweien/docx-template-system/issues/48)
* **data-table:** Tab/Enter 连续编辑，提交后自动跳到下一个单元格 ([223328e](https://github.com/zweien/docx-template-system/commit/223328e152bbd1fa2a07bc63e83aa5d2c1f07603)), closes [#44](https://github.com/zweien/docx-template-system/issues/44)
* **forms:** 填表页面浮动 AI 助手，支持大模型辅助内容填充 ([b14f8a5](https://github.com/zweien/docx-template-system/commit/b14f8a5557a70e7dc5b19428ae4597f17367a7e4))
* **forms:** AI 填充助手集成 agent2 工具能力 ([4dc3ed9](https://github.com/zweien/docx-template-system/commit/4dc3ed93f3dea22f62c8dc5226634a95e2277f07))
* **forms:** AI 填充助手支持下拉选项约束 ([4c7a46b](https://github.com/zweien/docx-template-system/commit/4c7a46b84920a802c68b566b049be366bc69d78a))
* **templates:** 支持模板级别 AI 填充助手 system prompt 配置 ([0da5453](https://github.com/zweien/docx-template-system/commit/0da5453837c656392b7b7509f3ccef6aaa30fbce))


### Bug Fixes

* 手机端 AI 助手页面侧边栏自动隐藏，改用 Sheet 抽屉展示 ([f1af0a6](https://github.com/zweien/docx-template-system/commit/f1af0a6fb69dad0b05b44d6b2ea3407b5ac4a2a8)), closes [#32](https://github.com/zweien/docx-template-system/issues/32)
* 修复 AI 助手查询数据表按自定义字段排序报错 ([12425b2](https://github.com/zweien/docx-template-system/commit/12425b249b615ef188591557575236fefe32ad8f))
* 修复 ThemeToggle hydration 不匹配 ([17bed51](https://github.com/zweien/docx-template-system/commit/17bed51d9868806cc4a75b221ffd6c3f4e076876))
* **agent2:** 确认工具改为受控 open 替代 defaultOpen 确保自动展开 ([80a47c4](https://github.com/zweien/docx-template-system/commit/80a47c4810be37d1b156b5e72196dcb20ff1aaf9))
* **agent2:** 确认框内容区域增加滚动，确保操作按钮始终可见 ([e004be9](https://github.com/zweien/docx-template-system/commit/e004be9631b7c8b9f8dbb25ef2871bb79b2029a1))
* **agent2:** 修复 importPaper 工具在 auto-confirm 模式下未真正执行导入的问题 ([b19332c](https://github.com/zweien/docx-template-system/commit/b19332c38c7a1d62b80b818f2fc6ce1d464bea05))
* **agent2:** 修复确认后AI重复调用工具的问题 ([9f2dcc4](https://github.com/zweien/docx-template-system/commit/9f2dcc4df8235b40f817d28451e98d0ca392c2cf))
* **agent2:** 修复审查发现的三个问题 ([41cbe0a](https://github.com/zweien/docx-template-system/commit/41cbe0ab53941fae25b938a7e87f74eabfa69c6e))
* **agent2:** paper_id 改为数字自增（当前最大值+1） ([1370cdb](https://github.com/zweien/docx-template-system/commit/1370cdb0c4e764e08c26b4dfc2f97ed964d31273))
* **data-table:** 单击选中单元格而非直接编辑，编辑后本地乐观更新 ([a997d78](https://github.com/zweien/docx-template-system/commit/a997d7852dfd38ed4bf4bf5aca591810302b4f55))
* **data-table:** 快速新建行支持跳过必填字段验证 ([d39cb5f](https://github.com/zweien/docx-template-system/commit/d39cb5f10bd88c1f2bb62bad9f7df710702cfbe1))
* **data-table:** 修复查找栏跳转不到匹配单元格的索引映射问题 ([b6fdb48](https://github.com/zweien/docx-template-system/commit/b6fdb482e29ca79d42de9bd5ee48da7da4ddedc2))
* **data-table:** 修复筛选运算符的四个 review 问题 ([fb6f91d](https://github.com/zweien/docx-template-system/commit/fb6f91d8e7311b2d5242927563db2ecd4c5b8f59))
* **data-table:** 重构 FindReplaceBar 索引体系，直接使用 flatRecords 原始索引 ([04716f4](https://github.com/zweien/docx-template-system/commit/04716f438e4b0dd635ee613180aa2e87aeed4200))
* **forms:** AI 填充助手按钮移至右上角 ([45b7ec1](https://github.com/zweien/docx-template-system/commit/45b7ec168effa5ca8069caf82472f44f49eee770))
* **forms:** AI 填充助手支持多选字段和选项值映射 ([a493345](https://github.com/zweien/docx-template-system/commit/a493345b22e8b78fffca6ebd497c9d5828898a2a))

## [0.3.11](https://github.com/zweien/docx-template-system/compare/v0.3.10...v0.3.11) (2026-04-14)


### Features

* 数据表定期备份功能 ([bc09b0f](https://github.com/zweien/docx-template-system/commit/bc09b0fabfeed676eb36319c05e4c4ccfbd493f2)), closes [#27](https://github.com/zweien/docx-template-system/issues/27)
* 添加数据表备份恢复功能 ([3d061fd](https://github.com/zweien/docx-template-system/commit/3d061fd3f7e84fd078a6656ce8f41c745da687f6))
* **agent2:** 前端确认工具自动展开 + 详情卡片渲染 ([5320682](https://github.com/zweien/docx-template-system/commit/53206821d0a7c587899f40d2c515b8530794799f))
* **agent2:** 确认后自动发送工具结果，AI 继续生成执行结果回复 ([eaca192](https://github.com/zweien/docx-template-system/commit/eaca1928c45812e244c504c9ff50ec8229b477f4))
* **agent2:** 添加 DOI 查询服务（Crossref API） ([3c7ce3b](https://github.com/zweien/docx-template-system/commit/3c7ce3b92356bade478c29c55d2db5ebbe6fb24a))
* **agent2:** 添加 importPaper 到确认机制和执行器 ([f81244e](https://github.com/zweien/docx-template-system/commit/f81244e5935b7fa4c0f4a7742067a1786b7dc6ba))
* **agent2:** 添加论文导入执行器（作者匹配+关联建立） ([57a1c8c](https://github.com/zweien/docx-template-system/commit/57a1c8ce2ad0ec1f00f5ca1d955e179dfc782cc4))
* **agent2:** 添加确认工具详情预取函数 fetchDetailPreview ([0ff8355](https://github.com/zweien/docx-template-system/commit/0ff8355a92213d13587ae7a703d867bff9a74de8))
* **agent2:** 系统提示增加论文导入能力说明 ([5e04172](https://github.com/zweien/docx-template-system/commit/5e04172de54de522837c34d8e0b9ee7b6d5e4519))
* **agent2:** 注册论文导入工具（parsePaperText, fetchPaperByDOI, importPaper） ([8cf3106](https://github.com/zweien/docx-template-system/commit/8cf31069bd911a6f3392b9dbbb4a169a4d93f65a))
* **agent2:** restrict write tools to admin users only ([7ea4290](https://github.com/zweien/docx-template-system/commit/7ea42909747d875cf153febc8b4d7957576bf096))
* **agent2:** stopWhen 检测 _needsConfirm 停止 + 修复移动端选择类型 ([2051aa4](https://github.com/zweien/docx-template-system/commit/2051aa45e61ff34483a609b6fc24b31515bb9c32))
* **agent2:** system prompt 添加确认流程和删除操作指导 ([2b50044](https://github.com/zweien/docx-template-system/commit/2b50044b123b93f751217baf615ff8fcc7dbf19d))
* **agent2:** wrapConfirm 返回 detailPreview 字段 ([0efdb66](https://github.com/zweien/docx-template-system/commit/0efdb6632a9ed14b492e271dca78d31989854946))
* AI 助手对话建议支持管理员自定义配置 ([9cd88cd](https://github.com/zweien/docx-template-system/commit/9cd88cd9474a77d4d9e3329e2e91edcd71af20ed)), closes [#33](https://github.com/zweien/docx-template-system/issues/33)
* **data-table:** 多单元格区域选择和批量复制粘贴 ([f166db2](https://github.com/zweien/docx-template-system/commit/f166db23a0013cfe84db34fa1966ad5f049d9952)), closes [#47](https://github.com/zweien/docx-template-system/issues/47)
* **data-table:** 分页支持自定义每页显示条目数 ([2da9df8](https://github.com/zweien/docx-template-system/commit/2da9df8d76d0fc057553e3623bf8041228cb96c4)), closes [#59](https://github.com/zweien/docx-template-system/issues/59)
* **data-table:** 分页组件增强，支持首页/末页/页码跳转 ([d1bede6](https://github.com/zweien/docx-template-system/commit/d1bede6690dbe5fd95c30128cece3ef5cde021a4)), closes [#57](https://github.com/zweien/docx-template-system/issues/57)
* **data-table:** 记录级别变更历史审计 ([62cc0cd](https://github.com/zweien/docx-template-system/commit/62cc0cd877e70eadf51f06809afa28301c07480f)), closes [#52](https://github.com/zweien/docx-template-system/issues/52)
* **data-table:** 扩展筛选运算符支持更多过滤条件 ([a06e827](https://github.com/zweien/docx-template-system/commit/a06e82707dc0bfafa9e58b2d7550d96dd0f4225b)), closes [#51](https://github.com/zweien/docx-template-system/issues/51)
* **data-table:** 网格底部快捷新建行入口 ([e859945](https://github.com/zweien/docx-template-system/commit/e859945ea96cadbad5528f636c97ed4dd4b1d8ea)), closes [#45](https://github.com/zweien/docx-template-system/issues/45)
* **data-table:** 新增 Shift+Enter 插入行、Ctrl+X 剪切、Ctrl+D 复制行快捷键 ([#72](https://github.com/zweien/docx-template-system/issues/72)) ([2374da1](https://github.com/zweien/docx-template-system/commit/2374da164faa40114330cf03d5d14590c212ac89)), closes [#69](https://github.com/zweien/docx-template-system/issues/69)
* **data-table:** 虚拟滚动替代分页，全量加载+自定义行窗口化 ([703534a](https://github.com/zweien/docx-template-system/commit/703534a0cd873885ffa8599d847fe6643355c911)), closes [#46](https://github.com/zweien/docx-template-system/issues/46)
* **data-table:** 支持单元格拖拽自动填充（fill handle） ([43483d1](https://github.com/zweien/docx-template-system/commit/43483d1538d5cf4e6ecf8f60ce891de6ccbcfbde)), closes [#50](https://github.com/zweien/docx-template-system/issues/50)
* **data-table:** 支持行高调整四档（紧凑/标准/宽松/超高） ([f6d4e1c](https://github.com/zweien/docx-template-system/commit/f6d4e1c91ab1963ac6c6702bbcb1e7be2f1fdda8)), closes [#49](https://github.com/zweien/docx-template-system/issues/49)
* **data-table:** Ctrl+方向键跳转边缘、Ctrl+; 填入当前日期 ([#73](https://github.com/zweien/docx-template-system/issues/73)) ([b97e913](https://github.com/zweien/docx-template-system/commit/b97e9132201f47168aea48621a1c7a99de3dff2d)), closes [#70](https://github.com/zweien/docx-template-system/issues/70)
* **data-table:** Ctrl+F 查找替换栏 ([2242d0e](https://github.com/zweien/docx-template-system/commit/2242d0e85a6180576683b01acd5c4c67264fc5ca)), closes [#71](https://github.com/zweien/docx-template-system/issues/71)
* **data-table:** Shift+Space 快捷键打开记录详情抽屉 ([c91c43a](https://github.com/zweien/docx-template-system/commit/c91c43abadba9a83b39d78de9f127956b147cefb)), closes [#48](https://github.com/zweien/docx-template-system/issues/48)
* **data-table:** Tab/Enter 连续编辑，提交后自动跳到下一个单元格 ([223328e](https://github.com/zweien/docx-template-system/commit/223328e152bbd1fa2a07bc63e83aa5d2c1f07603)), closes [#44](https://github.com/zweien/docx-template-system/issues/44)
* **forms:** 填表页面浮动 AI 助手，支持大模型辅助内容填充 ([b14f8a5](https://github.com/zweien/docx-template-system/commit/b14f8a5557a70e7dc5b19428ae4597f17367a7e4))
* **forms:** AI 填充助手集成 agent2 工具能力 ([4dc3ed9](https://github.com/zweien/docx-template-system/commit/4dc3ed93f3dea22f62c8dc5226634a95e2277f07))
* **forms:** AI 填充助手支持下拉选项约束 ([4c7a46b](https://github.com/zweien/docx-template-system/commit/4c7a46b84920a802c68b566b049be366bc69d78a))
* **templates:** 支持模板级别 AI 填充助手 system prompt 配置 ([0da5453](https://github.com/zweien/docx-template-system/commit/0da5453837c656392b7b7509f3ccef6aaa30fbce))


### Bug Fixes

* 手机端 AI 助手页面侧边栏自动隐藏，改用 Sheet 抽屉展示 ([f1af0a6](https://github.com/zweien/docx-template-system/commit/f1af0a6fb69dad0b05b44d6b2ea3407b5ac4a2a8)), closes [#32](https://github.com/zweien/docx-template-system/issues/32)
* 修复 AI 助手查询数据表按自定义字段排序报错 ([12425b2](https://github.com/zweien/docx-template-system/commit/12425b249b615ef188591557575236fefe32ad8f))
* 修复 ThemeToggle hydration 不匹配 ([17bed51](https://github.com/zweien/docx-template-system/commit/17bed51d9868806cc4a75b221ffd6c3f4e076876))
* **agent2:** 确认工具改为受控 open 替代 defaultOpen 确保自动展开 ([80a47c4](https://github.com/zweien/docx-template-system/commit/80a47c4810be37d1b156b5e72196dcb20ff1aaf9))
* **agent2:** 确认框内容区域增加滚动，确保操作按钮始终可见 ([e004be9](https://github.com/zweien/docx-template-system/commit/e004be9631b7c8b9f8dbb25ef2871bb79b2029a1))
* **agent2:** 修复 importPaper 工具在 auto-confirm 模式下未真正执行导入的问题 ([b19332c](https://github.com/zweien/docx-template-system/commit/b19332c38c7a1d62b80b818f2fc6ce1d464bea05))
* **agent2:** 修复确认后AI重复调用工具的问题 ([9f2dcc4](https://github.com/zweien/docx-template-system/commit/9f2dcc4df8235b40f817d28451e98d0ca392c2cf))
* **agent2:** 修复审查发现的三个问题 ([41cbe0a](https://github.com/zweien/docx-template-system/commit/41cbe0ab53941fae25b938a7e87f74eabfa69c6e))
* **agent2:** paper_id 改为数字自增（当前最大值+1） ([1370cdb](https://github.com/zweien/docx-template-system/commit/1370cdb0c4e764e08c26b4dfc2f97ed964d31273))
* **data-table:** 单击选中单元格而非直接编辑，编辑后本地乐观更新 ([a997d78](https://github.com/zweien/docx-template-system/commit/a997d7852dfd38ed4bf4bf5aca591810302b4f55))
* **data-table:** 快速新建行支持跳过必填字段验证 ([d39cb5f](https://github.com/zweien/docx-template-system/commit/d39cb5f10bd88c1f2bb62bad9f7df710702cfbe1))
* **data-table:** 修复查找栏跳转不到匹配单元格的索引映射问题 ([b6fdb48](https://github.com/zweien/docx-template-system/commit/b6fdb482e29ca79d42de9bd5ee48da7da4ddedc2))
* **data-table:** 修复筛选运算符的四个 review 问题 ([fb6f91d](https://github.com/zweien/docx-template-system/commit/fb6f91d8e7311b2d5242927563db2ecd4c5b8f59))
* **data-table:** 重构 FindReplaceBar 索引体系，直接使用 flatRecords 原始索引 ([04716f4](https://github.com/zweien/docx-template-system/commit/04716f438e4b0dd635ee613180aa2e87aeed4200))
* **forms:** AI 填充助手按钮移至右上角 ([45b7ec1](https://github.com/zweien/docx-template-system/commit/45b7ec168effa5ca8069caf82472f44f49eee770))
* **forms:** AI 填充助手支持多选字段和选项值映射 ([a493345](https://github.com/zweien/docx-template-system/commit/a493345b22e8b78fffca6ebd497c9d5828898a2a))

## [0.3.10](https://github.com/zweien/docx-template-system/compare/v0.3.9...v0.3.10) (2026-04-10)


### Features

* **agent2:** 聊天流程集成 MCP 工具 ([82ab184](https://github.com/zweien/docx-template-system/commit/82ab184cd0f8729f6ecec7f37a1d2425b535b520))
* **agent2:** 设置弹窗新增 MCP 服务器管理选项卡 ([2e3a234](https://github.com/zweien/docx-template-system/commit/2e3a2345c23b73d29333e98a8e22b21d78750e2c))
* **agent2:** 系统提示增加 MCP 说明，确认机制增加 MCP 类别，工具来源标记 ([dec8424](https://github.com/zweien/docx-template-system/commit/dec8424d77b21f4c190099a7cce97da102341fc6))
* **agent2:** 新增 MCP 服务器 CRUD 服务层 ([b26d03b](https://github.com/zweien/docx-template-system/commit/b26d03baf350fb888da8666cad88bd822f5c16d3))
* **agent2:** 新增 MCP 服务器创建/更新校验 Schema ([cfd2753](https://github.com/zweien/docx-template-system/commit/cfd27530db4b7a6aa5d025bed572244ed5f339dd))
* **agent2:** 新增 MCP 服务器管理 API 路由 ([ad8818b](https://github.com/zweien/docx-template-system/commit/ad8818b78f8f96d87fba09538a9f57220b6f1c57))
* **agent2:** 新增 MCP 服务器管理器组件 ([8494383](https://github.com/zweien/docx-template-system/commit/84943831ca8b78b65bb18e023df9c4578473f12e))
* **agent2:** 新增 MCP 服务器和工具相关类型定义 ([cc26508](https://github.com/zweien/docx-template-system/commit/cc265081a3bec49a9e5511d40ab6f8bb0963ac7f))
* **agent2:** 新增 MCP 客户端管理和工具获取模块 ([3eac62c](https://github.com/zweien/docx-template-system/commit/3eac62ce26db55f29a4f18ec645a4dd90b42a89b))
* **agent2:** 新增 McpTransportType 枚举和 Agent2McpServer 模型 ([22f4ed1](https://github.com/zweien/docx-template-system/commit/22f4ed1a242d424a73cf6af46d91c2173e680686))


### Bug Fixes

* 修复 Agent2 页面控制台错误 ([7514d52](https://github.com/zweien/docx-template-system/commit/7514d526a5f2e6a7e158bb33c1afd92bda2f989b))
* 修复 Codex review 提出的三个问题 ([b9d4b23](https://github.com/zweien/docx-template-system/commit/b9d4b232298531f909a71eceaed000dfdfd13727))
* 修复 MCP 模块类型错误（Zod v4 record、encrypt 导出、Prisma Json 类型） ([185b67c](https://github.com/zweien/docx-template-system/commit/185b67cc2fa298a8da4c348eb18763357145f1ed))
* 修复 MCP 设置页面测试结果文本溢出对话框 ([49f4d77](https://github.com/zweien/docx-template-system/commit/49f4d77542bb0bbf587296fa840187854ad9742d))

## [0.3.9](https://github.com/zweien/docx-template-system/compare/v0.3.8...v0.3.9) (2026-04-10)


### Bug Fixes

* 修复多处 Base UI Button 控制台错误 ([a33aa35](https://github.com/zweien/docx-template-system/commit/a33aa353051a5596a44d6a403ac3328d891c3167))
* 移除 Lucide Image 组件多余的 alt 属性 ([c5eadc5](https://github.com/zweien/docx-template-system/commit/c5eadc506e777bcade4f96b25b51cf9815f2dc52))

## [0.3.8](https://github.com/zweien/docx-template-system/compare/v0.3.7...v0.3.8) (2026-04-09)


### Bug Fixes

* prompt-input BaseUIEvent type error ([57cb943](https://github.com/zweien/docx-template-system/commit/57cb943be8a718dc1238864d6f67e9a1bcec34de))

## [0.3.7](https://github.com/zweien/docx-template-system/compare/v0.3.6...v0.3.7) (2026-04-09)


### Features

* 浅色/暗色主题切换功能 ([#26](https://github.com/zweien/docx-template-system/issues/26)) ([4d05bcf](https://github.com/zweien/docx-template-system/commit/4d05bcf0466ddab557a47d3826c7ceb53b6159c8)), closes [#24](https://github.com/zweien/docx-template-system/issues/24)
* **api:** add screenshot upload/delete API ([e87188c](https://github.com/zweien/docx-template-system/commit/e87188cd8f1c38709c5e3c0d50563739a5870892))
* **data:** 添加编辑数据表描述功能 ([#23](https://github.com/zweien/docx-template-system/issues/23)) ([d706af8](https://github.com/zweien/docx-template-system/commit/d706af83ea6ea9a7c2161aa40740012ef1f6a616))
* **data:** 添加右键删除字段功能 ([#22](https://github.com/zweien/docx-template-system/issues/22)) ([6ee598e](https://github.com/zweien/docx-template-system/commit/6ee598e8859b1afd150ef6c49afd5ea99367cfdd))
* **generate:** add screenshot thumbnail to template cards ([7c349b3](https://github.com/zweien/docx-template-system/commit/7c349b3d2fdd432dd1afa6b726bd7c45d5093c8f))
* **generate:** include screenshot in template query ([ca7c247](https://github.com/zweien/docx-template-system/commit/ca7c247aea392be5d05bbf4dfa3c9fa57c09c8f9))
* **template:** add screenshot field to Template model ([009d29c](https://github.com/zweien/docx-template-system/commit/009d29c8721a39fb9ca3dd15367bd75001faa738))
* **template:** add updateScreenshot and deleteScreenshot methods ([683b712](https://github.com/zweien/docx-template-system/commit/683b7122c2d4d76f1c0010beae986e861d650648))
* **template:** include screenshot in getTemplate response ([712697c](https://github.com/zweien/docx-template-system/commit/712697c608f49cfd665eb871fae20f162d0db8fd))
* **template:** show screenshot on template detail page ([1c1614d](https://github.com/zweien/docx-template-system/commit/1c1614d9e0a45a4b31a472a6831d8afff1aae2c7))
* **wizard:** add screenshot upload to template wizard ([c490e35](https://github.com/zweien/docx-template-system/commit/c490e351dd7dbb9073a8194bc8bbee71cf2d0cb9))


### Bug Fixes

* **auth:** 修复用户管理界面无法删除用户的问题 ([#21](https://github.com/zweien/docx-template-system/issues/21)) ([6a31de9](https://github.com/zweien/docx-template-system/commit/6a31de9c350223825dd26efc72dc5ff2f455ac1a))
* ensure screenshot is passed to generate page client ([071a489](https://github.com/zweien/docx-template-system/commit/071a489e33bc9c3977733476720b81c60074f32c))
* regenerate Prisma client and fix TypeScript errors ([708f252](https://github.com/zweien/docx-template-system/commit/708f2526c8aa9e436fd8430f56101bc0ce64869d))
* screenshot path bug and improve template card layout ([a0dcebb](https://github.com/zweien/docx-template-system/commit/a0dcebb7e699b80cb57dfe0a1eaa47556624f8fc))

## [0.3.6](https://github.com/zweien/docx-template-system/compare/v0.3.5...v0.3.6) (2026-04-08)


### Bug Fixes

* **auth:** 修复统一登录提示登陆失败的问题 ([411de1d](https://github.com/zweien/docx-template-system/commit/411de1d5683e457c34eff2f22851a8a5ee7c036a))

## [0.3.5](https://github.com/zweien/docx-template-system/compare/v0.3.4...v0.3.5) (2026-04-08)


### Features

* **agent2:** 添加管理员系统设置页面 ([#14](https://github.com/zweien/docx-template-system/issues/14)) ([8097dfe](https://github.com/zweien/docx-template-system/commit/8097dfeb5c5e28f1cba8acd88de8535cdcec7e80))
* **data-table:** 添加字段编辑功能 ([52b55a8](https://github.com/zweien/docx-template-system/commit/52b55a8d2a562c99c9b46a2d2db6000ee5792ca4))


### Bug Fixes

* **agent2:** 测试连接错误信息换行显示 ([#15](https://github.com/zweien/docx-template-system/issues/15)) ([0084567](https://github.com/zweien/docx-template-system/commit/00845678032063322b013e541031233f38db0251))
* **data-table:** 修复编辑字段类型保存不生效的问题 ([fb5a47e](https://github.com/zweien/docx-template-system/commit/fb5a47e5de00875499eba835b09b9ed88a6227e0))

## [0.3.4](https://github.com/zweien/docx-template-system/compare/v0.3.3...v0.3.4) (2026-04-07)


### Bug Fixes

* **agent2:** support kimi reasoning_content in stream responses ([c49db4a](https://github.com/zweien/docx-template-system/commit/c49db4a02d277708ff14aa13431c738fada070ca))

## [0.3.3](https://github.com/zweien/docx-template-system/compare/v0.3.2...v0.3.3) (2026-04-07)


### Features

* **agent2:** add edit and test connection buttons to model manager ([665136b](https://github.com/zweien/docx-template-system/commit/665136b305169cbddce8bf3fc2c778f15cc74c05))
* **agent2:** add edit and test connection buttons to model manager ([b56368e](https://github.com/zweien/docx-template-system/commit/b56368ead774c8a879c10639bd0978b2b00eee37))
* **agent2:** add PUT endpoint for model update ([809b016](https://github.com/zweien/docx-template-system/commit/809b016697dac6e0195e1c4c991075bf9881d694))
* **agent2:** add PUT endpoint for model update ([7a80964](https://github.com/zweien/docx-template-system/commit/7a80964a204bc4359d1fe3c9967ff5753b7184c0))
* **agent2:** add test connection API endpoint ([e8cb0fe](https://github.com/zweien/docx-template-system/commit/e8cb0fe76229a8c2fa0bd0dcdb4f4fc8864b1960))
* **agent2:** add test connection API endpoint ([b7ce687](https://github.com/zweien/docx-template-system/commit/b7ce687c1213964fc84d34ebaad3542364244041))
* **agent2:** add updateModel and testModelConnection functions ([cbb626a](https://github.com/zweien/docx-template-system/commit/cbb626a464c1c63b363e624d3aee2bd91ceb48bf))
* **agent2:** add updateModel and testModelConnection functions ([c39ce4f](https://github.com/zweien/docx-template-system/commit/c39ce4fa8233e5c8e12c8b5dabfd38980ab09cea))
* **agent2:** update model validation schema ([33f8e93](https://github.com/zweien/docx-template-system/commit/33f8e93b2a1f75f577897366757cecbd9a65945c))
* **agent2:** update model validation schema ([60872b5](https://github.com/zweien/docx-template-system/commit/60872b50f1db855d6d5a9e1258012072efcff9e8))


### Bug Fixes

* **agent2:** address code review - preserve API key on edit, include credentials when testing, support partial updates ([da8e75f](https://github.com/zweien/docx-template-system/commit/da8e75fd588d5bd7543c932d2b2a894fa3f62006))
* **agent2:** address code review - preserve API key on edit, include credentials when testing, support partial updates ([1f90029](https://github.com/zweien/docx-template-system/commit/1f90029e69612b5f7e81d028eeafa859c982cf59))
* **agent2:** display model name instead of id in chat header ([d3e8628](https://github.com/zweien/docx-template-system/commit/d3e862877a40ebd45cb15b2e34fe9780bfb75ac2))
* **agent2:** pass model config ID to test API for retrieving saved API key ([62f830e](https://github.com/zweien/docx-template-system/commit/62f830e2c7c725c92b1dfd5c077d02960301f818))
* **agent2:** pass model config ID to test API for retrieving saved API key ([7368442](https://github.com/zweien/docx-template-system/commit/736844200ca816dec149572e4071fcf3137bfe4b))
* **agent2:** reset chat when model changes ([954a6f9](https://github.com/zweien/docx-template-system/commit/954a6f958b28ef7c4fa9b1d38eb08a66df7b7130))
* **agent2:** reset chat when model changes ([aaef53f](https://github.com/zweien/docx-template-system/commit/aaef53f29b238d96b410f50eefe134f755310a05))
* **agent2:** show test result in edit dialog ([cce610c](https://github.com/zweien/docx-template-system/commit/cce610cae926191e03a785a0a05c77c07f2f3e34))
* **agent2:** show test result in edit dialog ([2cbaeff](https://github.com/zweien/docx-template-system/commit/2cbaeffc24965ad1ef24489d0a6741cde30c5278))

## [0.3.2](https://github.com/zweien/docx-template-system/compare/v0.3.1...v0.3.2) (2026-04-07)


### Bug Fixes

* 修复文档下载失败 + Docker 卷权限问题 ([#4](https://github.com/zweien/docx-template-system/issues/4)) ([326b565](https://github.com/zweien/docx-template-system/commit/326b565f0768772780dd9fda14f8deb264f514c1)), closes [#3](https://github.com/zweien/docx-template-system/issues/3)
* **mobile-nav:** add missing nav items for mobile sidebar ([#5](https://github.com/zweien/docx-template-system/issues/5)) ([83d0f8d](https://github.com/zweien/docx-template-system/commit/83d0f8d56c1584ac650ca397457b336e898427e2)), closes [#2](https://github.com/zweien/docx-template-system/issues/2)

## [0.3.1](https://github.com/zweien/docx-template-system/compare/v0.3.0...v0.3.1) (2026-04-07)


### Bug Fixes

* increase SSH command timeout to 15m for deploy workflow ([47853da](https://github.com/zweien/docx-template-system/commit/47853daf841df18f2b6722b973b0d12233eb104e))

## [0.3.0](https://github.com/zweien/docx-template-system/compare/v0.2.3...v0.3.0) (2026-04-07)


### Features

* **data-table:** add export dropdown to table-card and record-table ([53c5e59](https://github.com/zweien/docx-template-system/commit/53c5e59f8ab5b6d34388b98f5a4e4830a5875f57))
* **data-table:** add exportToJSON for JSON format export ([e30d8c8](https://github.com/zweien/docx-template-system/commit/e30d8c8128cf74c0e64cb7305cce1827c9b62c33))
* **data-table:** add exportToSQL for PostgreSQL-compatible SQL export ([9f94549](https://github.com/zweien/docx-template-system/commit/9f94549efa9527c2d1ec380f3427ab973137d870))
* **data-table:** add importFromJSON service and JSON import validators ([f826cb9](https://github.com/zweien/docx-template-system/commit/f826cb900796fbb97cfa25584a7be216832da28d))
* **data-table:** add JSON and SQL export API routes ([987980a](https://github.com/zweien/docx-template-system/commit/987980a9e7e0660d4c747632621428cd82e3455e))
* **data-table:** add JSON import API route ([b9fa989](https://github.com/zweien/docx-template-system/commit/b9fa9897dc52ba8021fefae0c35e89b2964c3df3))
* **data-table:** create export.service.ts with getTableExportData ([392248a](https://github.com/zweien/docx-template-system/commit/392248a1c99dc1ebe65a70ea11b41f8323b8d9d4))
* **data-table:** migrate exportToExcel to export.service.ts ([3f0b314](https://github.com/zweien/docx-template-system/commit/3f0b314bdec1179592a9e5bb89a4ed5ee1698e1c))
* support creating a full data table from JSON import on /data page ([6c838b0](https://github.com/zweien/docx-template-system/commit/6c838b0198ef4e4c720215ae9c1739304f0492d3))
* support JSON file import in import wizard ([5b1d39c](https://github.com/zweien/docx-template-system/commit/5b1d39cb6208a8c7f95edb3e715ea271d1c3114f))


### Bug Fixes

* allow deleting data tables with template references and inverse fields ([85bb37d](https://github.com/zweien/docx-template-system/commit/85bb37d8b737af159e6bd65961cd601f1e708cb2))
* **data-table:** ensure unique temporary IDs for new fields and add field key uniqueness validation ([b37c0af](https://github.com/zweien/docx-template-system/commit/b37c0af466f5ac928a03b78dabf4658e7fa6bb56))
* use --force flag for git fetch tags in deploy workflow ([c20d211](https://github.com/zweien/docx-template-system/commit/c20d21197ede530d0ecea4b7fa05ffb7c37e2e58))

## [0.1.2](https://github.com/zweien/docx-template-system/compare/v0.2.2...v0.1.2) (2026-04-07)


### Bug Fixes

* resolve build failures with turbopack and fix TS type errors ([0310b03](https://github.com/zweien/docx-template-system/commit/0310b0319b0305c2cf8f7e0b5d72bac64a8520c1))

## 0.1.1 (2026-04-06)


### Features

* adapt services for version-aware document generation ([b7bf381](https://github.com/zweien/docx-template-system/commit/b7bf381d641e0f97c9d12dd25ce6509ef9512421))
* add batchUpdate and batchDelete to data-record.service ([fd10264](https://github.com/zweien/docx-template-system/commit/fd1026425a59a806f5b4af8e807e38d82f028abe))
* add category and tag manager dialog component ([3de3a15](https://github.com/zweien/docx-template-system/commit/3de3a153c965ff08d22c08429f65c9feff00a300))
* add category and tag selection to template wizard step 1 ([244dd8f](https://github.com/zweien/docx-template-system/commit/244dd8f8d9b8e470ee2a4d78bbcb024269faa4d3))
* add category and tag types and validators ([8878888](https://github.com/zweien/docx-template-system/commit/88788883c25d84d3ac45f987342066ebcc89227a))
* add category tags, filter tabs, and columns to templates page ([1ea2088](https://github.com/zweien/docx-template-system/commit/1ea20880189c56790f0d5b2bc694ecb4d7a86188))
* add category, tag, and search filtering to template service ([ca9b548](https://github.com/zweien/docx-template-system/commit/ca9b54827b16f5cda2ccd209bd425d8601c605f4))
* add Category, Tag, and TagOnTemplate models to schema ([e820b2d](https://github.com/zweien/docx-template-system/commit/e820b2da158fb1b5ff19a08bbe647d951b9e84ad))
* add clickable links to dashboard stat card titles ([aefddb7](https://github.com/zweien/docx-template-system/commit/aefddb72fec621bac9dfdc10833e91e37bdc9f78))
* add collapsible sidebar and move user nav to sidebar footer ([d9748eb](https://github.com/zweien/docx-template-system/commit/d9748eb4c621f2b8c9e7eb7b4d996b1be5223a2f))
* add ColumnHeader component with filter/sort popover ([58e71ff](https://github.com/zweien/docx-template-system/commit/58e71ff7764742da45e1f47b074f0b4a9ba9bda0))
* add dashboard and template list pages ([b0e5785](https://github.com/zweien/docx-template-system/commit/b0e5785ba1416a085a1cea6ff1ee3e411c2868cf))
* add dashboard layout with sidebar, header, and session provider ([a6d49da](https://github.com/zweien/docx-template-system/commit/a6d49dab972834607cd445e5ea05c068aa637f0c))
* add data view service layer ([7941ce9](https://github.com/zweien/docx-template-system/commit/7941ce9a4352dcdfacdf784af6305662fcd83bba))
* add DataPickerDialog component ([b263476](https://github.com/zweien/docx-template-system/commit/b2634765387ed21a8236737edc867b4b7eab9e32))
* add DataView model for table view configurations ([5afdfbf](https://github.com/zweien/docx-template-system/commit/5afdfbf47cad393e1d8ae144f82431692da3e016))
* add delete button to data view selector ([decf0f5](https://github.com/zweien/docx-template-system/commit/decf0f50ed6a90686f3e5a9caeb6c86f801a0afa))
* add description column to placeholder config table ([f1806c0](https://github.com/zweien/docx-template-system/commit/f1806c0fd6411f4646f38d8123ad5eeb110841a7))
* add description field to Placeholder and propagate through data layer ([802790f](https://github.com/zweien/docx-template-system/commit/802790fc95cf2b034f20dc0617398c4e76bed502))
* add draft and record API routes for CRUD operations ([bc31764](https://github.com/zweien/docx-template-system/commit/bc3176450a88b9d558d82e3260403411282b475b))
* add draft and record business logic services ([8fa225f](https://github.com/zweien/docx-template-system/commit/8fa225f76c098822a5d8b29b4fa59f8877a9631b))
* add dynamic form component, fill page, and drafts list page ([77da0df](https://github.com/zweien/docx-template-system/commit/77da0df553c75ce79c0166d9d679f5c69d6a69f1))
* add DynamicTableField component and integrate into form ([2801f82](https://github.com/zweien/docx-template-system/commit/2801f82c0bcf0d852170556d41c1e77d89e5ae5d))
* add FieldConfigPopover for column visibility and ordering ([01cd0b8](https://github.com/zweien/docx-template-system/commit/01cd0b867477b1b9930ff993c2e57f0c9cd66849))
* add file storage service and docx placeholder parser ([9a0899a](https://github.com/zweien/docx-template-system/commit/9a0899a6204a971a34e2057cbeb7ca1d7f81a884))
* add in-memory cache utility with TTL support ([7c8ec6d](https://github.com/zweien/docx-template-system/commit/7c8ec6d98fc313bfdeb7cc8d6a7172b7bbbc848e))
* add incremental paper import with complete field mapping ([e57cbb6](https://github.com/zweien/docx-template-system/commit/e57cbb61e2bbb55bea486ecf2170fa279784afdb))
* add NextAuth.js authentication system with login page and route protection ([5519bb5](https://github.com/zweien/docx-template-system/commit/5519bb530da065485cac3f0f57a5bb1d9b78d786))
* add picker data and cascade resolve APIs ([0ce0fe3](https://github.com/zweien/docx-template-system/commit/0ce0fe3193ace25ca37352955349a1fd2274333d))
* add placeholder configuration page with editable table ([7311271](https://github.com/zweien/docx-template-system/commit/73112714f953ba16c95b95fb06cf9a1c6f99bbf9))
* add placeholder source binding API endpoints ([f0aa785](https://github.com/zweien/docx-template-system/commit/f0aa785e391db560f106b350e8a57ae13b499711))
* add Prisma schema, seed script, and database configuration ([cdff980](https://github.com/zweien/docx-template-system/commit/cdff98032933b73675f9734d57cc1dacca3da642))
* add publish, version list, and version detail API routes ([45e98be](https://github.com/zweien/docx-template-system/commit/45e98be8d07e77269e4330d9d23403c7c2e0fcaf))
* add records list page and record detail page ([0f361d9](https://github.com/zweien/docx-template-system/commit/0f361d9aa9ebccb492f2856e5b97200b7ccb940d))
* add relation field pair service ([ed52e14](https://github.com/zweien/docx-template-system/commit/ed52e144920eff5e1532fe0e1e1fca470be166d1))
* add relation subtable field configuration UI ([b192622](https://github.com/zweien/docx-template-system/commit/b192622b0a26904fe8c461b7369e439eeae83d16))
* add relation subtable schema ([0bb4249](https://github.com/zweien/docx-template-system/commit/0bb4249245fff661ae546269ed01e36e62b91eb7))
* add relation subtable types and validators ([ec6d3cb](https://github.com/zweien/docx-template-system/commit/ec6d3cb50011e2c98fa27cd31ec371b27e3a3091))
* add responsive design and mobile navigation support ([fe4dc9c](https://github.com/zweien/docx-template-system/commit/fe4dc9c63cd37792cb2f6ff8b0b356bf550904ba))
* add saveTemplateDraft, copyToVersion, deleteTemplateDir to file service ([fdecf0c](https://github.com/zweien/docx-template-system/commit/fdecf0c3239866d54627704f7cc95110dae74db1))
* add SaveViewDialog for saving view configurations ([61bf34d](https://github.com/zweien/docx-template-system/commit/61bf34d6b67964c4faa9c519a450d721eafc2aa7))
* add search, category filter, and tag filter to generate page ([d47c533](https://github.com/zweien/docx-template-system/commit/d47c533952056a54d2976c72d470801e5c000f26))
* add Skeleton and TableSkeleton components ([ab8b694](https://github.com/zweien/docx-template-system/commit/ab8b6948266875fc5dde6b4d192084d6e733629d))
* add sorting and view-level filtering to record service ([0cde938](https://github.com/zweien/docx-template-system/commit/0cde938003ff09dc542440580c3615d866a673b7))
* add source binding fields to Placeholder model ([17c9b8e](https://github.com/zweien/docx-template-system/commit/17c9b8e6dd48234399dbeb27197b4d79b6363c8f))
* add source binding UI to placeholder config table ([e0176d4](https://github.com/zweien/docx-template-system/commit/e0176d466a7d0933a3709111f22dacb783c44f85))
* add TABLE placeholder type and columns field to schema ([af6ee9f](https://github.com/zweien/docx-template-system/commit/af6ee9fa5538288739e946bd5954fb066cf77d77))
* add tag service and API routes ([d48e86f](https://github.com/zweien/docx-template-system/commit/d48e86fb46f69f6278496e89686f32d8922041c9))
* add template and placeholder business logic services ([615d2d8](https://github.com/zweien/docx-template-system/commit/615d2d8356052e16e47e2fcb8382565328763047))
* add template API routes for CRUD and placeholder management ([805c1eb](https://github.com/zweien/docx-template-system/commit/805c1eb04500e1f7e2fa709b40a2e6d4f7216bc7))
* add template upload page and template detail page ([dea232f](https://github.com/zweien/docx-template-system/commit/dea232f8844aff04640f59b2d24eb20dac0ed40f))
* add template wizard with 3-step flow ([74649f0](https://github.com/zweien/docx-template-system/commit/74649f0199bbaab51ab40c45a30a8b945f693aaf))
* add template-version service with publish, history, and detail ([783b6c4](https://github.com/zweien/docx-template-system/commit/783b6c4c44d8746a3fad05ade32750027724f466))
* add TemplateVersion model and migrate READY to PUBLISHED ([b0f90c1](https://github.com/zweien/docx-template-system/commit/b0f90c12bb65e8b5baa36781efb1be44c158284c))
* add TypeScript type definitions and Zod validation schemas ([618b055](https://github.com/zweien/docx-template-system/commit/618b055a791ada01ce5cd2128e2db032b02ababd))
* add useDebouncedCallback and useDebouncedValue hooks ([e58a965](https://github.com/zweien/docx-template-system/commit/e58a965f5acded6d85cbed8cc03685471f2950c5))
* add user management functionality for admins ([3bc88f2](https://github.com/zweien/docx-template-system/commit/3bc88f20ab17d7b89dea1f123b37d878be69f733))
* add version history dialog component ([d0431ff](https://github.com/zweien/docx-template-system/commit/d0431ffbea3370e2cc78ac967bd7c1642e4556f2))
* add version types and PlaceholderSnapshotItem ([a68f2ec](https://github.com/zweien/docx-template-system/commit/a68f2ec81ed2699a777792e164c1c8e6bcc9ef2c))
* add view CRUD API and extend records API with sorting ([200bf16](https://github.com/zweien/docx-template-system/commit/200bf1612f51b681589d9dde64b691685b6f2e59))
* add view-related type definitions ([82c5e68](https://github.com/zweien/docx-template-system/commit/82c5e6869037dc66d3bfe1f122a8d7c1bfebeb4b))
* add ViewSelector component for switching between saved views ([c66d60f](https://github.com/zweien/docx-template-system/commit/c66d60f0cd114ada9c609d8f708284ac8965e7bd))
* **agent2:** add all API routes including admin model management ([c9b6193](https://github.com/zweien/docx-template-system/commit/c9b6193715f319b3838af4079c333e0b18d7577b))
* **agent2:** add batch tool execution and file import hint ([5d127e4](https://github.com/zweien/docx-template-system/commit/5d127e4ad8ba2d1acab5b91793cf1bfa4c4250e8))
* **agent2:** add chat area with AI Elements integration ([690a700](https://github.com/zweien/docx-template-system/commit/690a700ce7ec4bcdb4c7327f75d4ca84aad4a2dd))
* **agent2:** add confirm dialog, chart renderer, settings dialog, model manager ([8836548](https://github.com/zweien/docx-template-system/commit/883654820406fd4d78efc16f67dec144373f8072))
* **agent2:** add conversation, message, settings, model services ([654906f](https://github.com/zweien/docx-template-system/commit/654906f9669e97dd1d1a6ac8c882301ccb8e4a9a))
* **agent2:** add dependencies and database schema ([651db36](https://github.com/zweien/docx-template-system/commit/651db36a92357c7af850073071587dd64f6fcad0))
* **agent2:** add filter field warnings and aggregate type validation ([9947353](https://github.com/zweien/docx-template-system/commit/9947353a26bac4b466fc191b67ef62218657f9c2))
* **agent2:** add page, layout, sidebar, and navigation ([2134248](https://github.com/zweien/docx-template-system/commit/2134248e2b6e6fe9232766e819a678e0de1e7763))
* **agent2:** add tools, confirm store, context builder, model resolver, tool executor ([a32621f](https://github.com/zweien/docx-template-system/commit/a32621f398804769c3d1a0badf7fc6206ef1194b))
* **agent2:** add types and validators ([3f3e57e](https://github.com/zweien/docx-template-system/commit/3f3e57e1cc8a78e27b81e10543a10519c6c09472))
* **agent2:** dynamic system prompt and document generation ([e895c2f](https://github.com/zweien/docx-template-system/commit/e895c2fd781001aecec307a471a8865a6485e0a8))
* **agent2:** P1+P2 data ops optimization ([240ca72](https://github.com/zweien/docx-template-system/commit/240ca72f00cc7f4f13f378471ac4ab05400bc653))
* **agent2:** register batch tools with confirm store ([0636abd](https://github.com/zweien/docx-template-system/commit/0636abde678ab74707eb641ac95dc94a2dc74fa3))
* **ai-agent:** 实现 AI Agent Service ([f66e8ac](https://github.com/zweien/docx-template-system/commit/f66e8aca2d0be3cf2b5d694d3705ccd821194d12))
* **ai-agent:** 实现 Context Builder ([afd3fea](https://github.com/zweien/docx-template-system/commit/afd3fea5622c9acf47cf73cb96069876a7133250))
* **ai-agent:** 实现工具函数层 ([ab6ac99](https://github.com/zweien/docx-template-system/commit/ab6ac9939d6655fcd17f7fe85a09fbc3f3b36109))
* **ai-agent:** add confirm token store with expiry ([bb7979f](https://github.com/zweien/docx-template-system/commit/bb7979fe6e0ac013f88e3019fd6f8dc4d51a85eb))
* **ai-agent:** add edit preview functions ([e0c3048](https://github.com/zweien/docx-template-system/commit/e0c3048605dc1c8641cde580f95f3b74b0056109))
* **ai-agent:** add edit tool definitions to service ([6a159b3](https://github.com/zweien/docx-template-system/commit/6a159b3ff9d70576c03409202f06b7d5b57a84a9))
* **ai-agent:** add edit types (EditPreview, EditOperation) ([0b24b82](https://github.com/zweien/docx-template-system/commit/0b24b8235701d4ec026c466a40adaf4d08ccd46a))
* **ai-agent:** add operation log model and service ([c8b35c9](https://github.com/zweien/docx-template-system/commit/c8b35c9debc7ed01cf9139e367ee8be803065cd2))
* **ai-agent:** add type definitions for AI Agent data query ([d798e91](https://github.com/zweien/docx-template-system/commit/d798e916159422257fc7887623789c28ac5b6c4c))
* **ai-agent:** implement confirm execution endpoint ([309b5fb](https://github.com/zweien/docx-template-system/commit/309b5fb0cb285be2453860e580141d9fe9f383ee))
* **ai-agent:** implement query validator ([c9381da](https://github.com/zweien/docx-template-system/commit/c9381da73ff5435f5ba57e695292384ec7bd9696))
* **ai-agent:** support configurable AI base_url and api_key ([4ddc579](https://github.com/zweien/docx-template-system/commit/4ddc57944aace6c53cc36475097833fa348f845c))
* **ai-chat:** add AI assistant chat page and drawer integration ([6b479c7](https://github.com/zweien/docx-template-system/commit/6b479c78ce10f86965f6c36dfd4ff45c6558819c))
* **api:** add AI agent API routes ([4d34550](https://github.com/zweien/docx-template-system/commit/4d345502da87e5a5ca8e33389a9ecb1c2de541cf))
* **api:** add batch generation API routes ([e875611](https://github.com/zweien/docx-template-system/commit/e8756111f126cde86a46200bb82cd17d5d92af3c))
* **api:** add template relation and field filtering endpoints ([42c37fb](https://github.com/zweien/docx-template-system/commit/42c37fbc75a635b2c44add47eb9ea535718fcae4))
* **batch:** integrate auto-select and field filtering ([e725e4b](https://github.com/zweien/docx-template-system/commit/e725e4b3772373ebbcab0cff36dbbaf7b21745cc))
* **components:** add batch generation step components ([46e3078](https://github.com/zweien/docx-template-system/commit/46e30785afd442eab927423de5a978653ab08c19))
* **components:** add DataTableLink and FieldMappingDialog ([2e5841d](https://github.com/zweien/docx-template-system/commit/2e5841d7a6be51cd053daa0924d86d42322fe5b8))
* **components:** add RecordFilter for field-level filtering ([e7fac20](https://github.com/zweien/docx-template-system/commit/e7fac20a1f01cb4da79fc60f94e5c5c8f337c2dc))
* convert generate page to client-side real-time filtering with version badges ([bbafa41](https://github.com/zweien/docx-template-system/commit/bbafa41e39aab50b1943b579c6b6281d41e869c7))
* **dashboard:** add collection tasks and data tables stats cards ([ce7f45d](https://github.com/zweien/docx-template-system/commit/ce7f45d2c23de3345e3967c145a6a4648280847c))
* **data:** add 9 cell editor components for inline editing ([ae1f722](https://github.com/zweien/docx-template-system/commit/ae1f722b15598c33f5f52e3ea6e68c84e10bcfb8))
* **data:** add auto-number injection, system field skip, URL/BOOLEAN validation ([1d3d1b6](https://github.com/zweien/docx-template-system/commit/1d3d1b6983d9bbf01cf825a6ca9f8af5d5370288))
* **data:** add batch selection, batch delete and batch edit ([db65ead](https://github.com/zweien/docx-template-system/commit/db65eadddd486263170db8f621808c1bfb24454b))
* **data:** add bottom summary bar with aggregate cycling ([23c5c6a](https://github.com/zweien/docx-template-system/commit/23c5c6a7ae3b422fbe22fc2ea17b7a94c615e4b0))
* **data:** add CellContextMenu component with cell/row/col menus ([f939c91](https://github.com/zweien/docx-template-system/commit/f939c91c31c46eee53b3a6a6ec26baa1a3e71a2d))
* **data:** add column drag-to-reorder in GridView using @dnd-kit/react ([a8f2589](https://github.com/zweien/docx-template-system/commit/a8f2589fceee1faf346af3684f8f06275725b818))
* **data:** add column freezing with sticky positioning and zone protection ([081f018](https://github.com/zweien/docx-template-system/commit/081f018fa629f61aff91ccfb83333e5af3b98c00))
* **data:** add column resizing with drag handle and auto-fit ([dc5607e](https://github.com/zweien/docx-template-system/commit/dc5607eb9ef1477e11b58bc026e7784202c5cae6))
* **data:** add ConditionalFormatRule type and management dialog ([72570ee](https://github.com/zweien/docx-template-system/commit/72570ee2b13fa5d01fe4588a24c761a85ac7f398))
* **data:** add FilterPanel with AND/OR grouped filter UI ([42bbc95](https://github.com/zweien/docx-template-system/commit/42bbc958d6b92c2510967fbde3b7701fff9b30cb))
* **data:** add GridView component with inline editing and grouping ([a4013e2](https://github.com/zweien/docx-template-system/commit/a4013e2ab244047f3cc273fbabddc9fa1110662c))
* **data:** add KanbanView component with column grouping by SELECT field ([42b3857](https://github.com/zweien/docx-template-system/commit/42b3857727dbd24593fc74075c05aacd42ac453a))
* **data:** add keyboard navigation with active cell tracking ([316d184](https://github.com/zweien/docx-template-system/commit/316d184c93fd937ccc2b22bb58b56d929e4f60a7))
* **data:** add new FieldType enum values and FieldOptions type ([baadceb](https://github.com/zweien/docx-template-system/commit/baadcebd249097852dafa4a96eeb29860976de3f))
* **data:** add optional groupBy toggle to ColumnHeader popover ([34cdce4](https://github.com/zweien/docx-template-system/commit/34cdce423e62bea9719a8f3b322340305b7276cb))
* **data:** add page info to always-visible pagination bar ([e9b608f](https://github.com/zweien/docx-template-system/commit/e9b608faac217b9a04322aad52dda46c20711e32))
* **data:** add RecordDetailDrawer shared component for all views ([335b0d6](https://github.com/zweien/docx-template-system/commit/335b0d69665cece6d80c084aea00e817e5406a37))
* **data:** add reorder API for manual row drag-and-drop sorting ([5d08568](https://github.com/zweien/docx-template-system/commit/5d08568378ed9b3f0f52ac22dda08294e36f321a))
* **data:** add row drag sort with grip handle ([71b752c](https://github.com/zweien/docx-template-system/commit/71b752c398490a488eeeb91f4acd7058b2664354))
* **data:** add sticky header and independent scroll to GridView ([104471c](https://github.com/zweien/docx-template-system/commit/104471c09f1740672d0881eea366837820f121a6))
* **data:** add summary API endpoint with aggregate computation ([f3de83e](https://github.com/zweien/docx-template-system/commit/f3de83e9b5bf6edfa81be43896cf2196e3822554))
* **data:** add Timeline view configuration panel for date/label field selection ([52f11a1](https://github.com/zweien/docx-template-system/commit/52f11a1130ea4260dee3a97e0b84b8634910f91d))
* **data:** add Timeline view with Gantt chart and scale options ([059d12f](https://github.com/zweien/docx-template-system/commit/059d12f4dd6273a561acf15a4527939a09cd80eb))
* **data:** add URL and BOOLEAN cell editors ([156684e](https://github.com/zweien/docx-template-system/commit/156684e538948013d9ebe4ce7efdf06aefd6a6e6))
* **data:** add useCellContext hook for right-click target tracking ([b40314f](https://github.com/zweien/docx-template-system/commit/b40314fbc0d42144bc68e573f8f2f5d52385683f))
* **data:** add useInlineEdit hook for cell-level inline editing ([e9b1cd8](https://github.com/zweien/docx-template-system/commit/e9b1cd8e30c0de8e34cc31fb63aa33013a38d5c4))
* **data:** add useTableData unified data hook for all views ([91d66e4](https://github.com/zweien/docx-template-system/commit/91d66e4b340c3694b1d9dd029b5e9b1fb5188dfb))
* **data:** add useUndoManager hook with async error handling ([8206f70](https://github.com/zweien/docx-template-system/commit/8206f70514fe3fa42f0b7f0ed814f88b61d95bc3))
* **data:** add ViewSwitcher component for Grid/Kanban/Gallery/Timeline ([82da019](https://github.com/zweien/docx-template-system/commit/82da019b9c6451968c0ba07fe81aed8a80099746))
* **data:** add ViewType enum and DataView columns (type, groupBy, viewOptions) ([ddf78ff](https://github.com/zweien/docx-template-system/commit/ddf78ff7d238d244929f8e7c306efec316baf052))
* **data:** add ViewType, update DataViewConfig/DataViewItem for multi-sort and viewOptions ([49a4e28](https://github.com/zweien/docx-template-system/commit/49a4e289768284420ec0fdf28681bf3d29e994ad))
* **data:** integrate conditional formatting into grid view rendering ([f3f5d08](https://github.com/zweien/docx-template-system/commit/f3f5d087a5c128003b6013e1b56fb0ec60d9ed20))
* **data:** integrate right-click context menu into grid view ([4b82d8f](https://github.com/zweien/docx-template-system/commit/4b82d8f7fdb15fc02e080bab033ead3e24dcbf4e))
* **data:** integrate undo/redo into grid view with keyboard shortcuts ([9c1a22a](https://github.com/zweien/docx-template-system/commit/9c1a22af9119e3103896d19f2cd5e016d4b45f6a))
* **data:** integrate URL, BOOLEAN, system field formatters and editors into grid ([97c840d](https://github.com/zweien/docx-template-system/commit/97c840dbcc93f815e29cb6e66596354e33db37fd))
* **data:** integrate ViewSwitcher and RecordDetailDrawer into table-detail page ([6394c43](https://github.com/zweien/docx-template-system/commit/6394c4377be1b4ae1616aeb812a50216de21c39d))
* **data:** update validators, services, and API routes for multi-sort, viewOptions, and ViewType ([de2adbf](https://github.com/zweien/docx-template-system/commit/de2adbff8ae21df1cfe1dbace8dfcaa684ca838a))
* **data:** wire Kanban/Gallery/Timeline views into RecordTable view router ([35b844f](https://github.com/zweien/docx-template-system/commit/35b844ffec7cbeca3e40c2d1e03ba306d9934fd7))
* **db:** add BatchGeneration model and extend Template/Record for batch generation ([cc6d59c](https://github.com/zweien/docx-template-system/commit/cc6d59c1c8b7a6b6c9894575622cd9a99ad8351d))
* display placeholder description in dynamic fill form ([c2149c0](https://github.com/zweien/docx-template-system/commit/c2149c0c0302fcabaae4c6f8db9ea5429c6ea5e9))
* display version in sidebar footer ([fb7b971](https://github.com/zweien/docx-template-system/commit/fb7b97123a1c4b3e6bff21d7dd19a76a2fa1d037))
* display version on login page ([62a644f](https://github.com/zweien/docx-template-system/commit/62a644f6082b46d1c42e590a30a90baa986e568f))
* edit relation subtable values in record forms ([76966cb](https://github.com/zweien/docx-template-system/commit/76966cb1df8c03af49e77bf4369e05680cb775c2))
* enhance template system with export, records improvements ([6579dc7](https://github.com/zweien/docx-template-system/commit/6579dc793cad1e2c8e01ab7afa976e342256c7db))
* **formula:** add evaluator, dependency graph, and barrel export ([45db835](https://github.com/zweien/docx-template-system/commit/45db83546b5ff1622c27f57baf8740510c6b8689))
* **formula:** add recursive-descent AST parser ([3efd6a0](https://github.com/zweien/docx-template-system/commit/3efd6a06aa16aca83be5dfcc03266ab8c1d036ee))
* **formula:** add tokenizer with field references, functions, and operators ([30e57e6](https://github.com/zweien/docx-template-system/commit/30e57e6ce04aa6059c150164eb47864520e77edf))
* **formula:** integrate formula engine with field config and record CRUD ([563980b](https://github.com/zweien/docx-template-system/commit/563980b0751907e2e652260fd2136c5bae378262))
* import relation subtables by business keys ([5b027a6](https://github.com/zweien/docx-template-system/commit/5b027a665103ce646cfa1729c03663c07bf04240))
* improve docx choice placeholder handling ([b51a0b6](https://github.com/zweien/docx-template-system/commit/b51a0b65b2314c3b69264097632e6791f7d5d8de))
* initial commit ([107e66d](https://github.com/zweien/docx-template-system/commit/107e66d8e277db53a588e52aee6d65c38816bc7a))
* inject NEXT_PUBLIC_APP_VERSION from package.json ([de995ea](https://github.com/zweien/docx-template-system/commit/de995eac5e2965125c43f38b433344c544b04561))
* integrate authentik oidc login ([e54a514](https://github.com/zweien/docx-template-system/commit/e54a5149c5f27f6a10fbf1eabe07cc0b4e88875c))
* integrate data picker into fill form with cascade auto-fill ([8e2e77a](https://github.com/zweien/docx-template-system/commit/8e2e77a68279eb9dd843639cfbe2cc9e08ca19d7))
* **mobile-nav:** add AI Assistant navigation item ([e9e5b81](https://github.com/zweien/docx-template-system/commit/e9e5b816949b4c7bf70d2cda7d17d5cc29805f09))
* **notifications:** add notification and remind API routes ([f8a695a](https://github.com/zweien/docx-template-system/commit/f8a695a943fb9c5fa9c27ab6158962865c0d2b7d))
* **notifications:** add Notification model and NotificationType enum to Prisma schema ([1d5182c](https://github.com/zweien/docx-template-system/commit/1d5182c78cf8e5b22c079af0f5cb663d102f812c))
* **notifications:** add NotificationBell, CollectionRemindButton UI components and integrate into layout ([c11e1ec](https://github.com/zweien/docx-template-system/commit/c11e1ec748281b28ce05ba4f271f44adbe1ea639))
* **notifications:** add TypeScript types and Zod validators for notifications ([275ca65](https://github.com/zweien/docx-template-system/commit/275ca654c41328a3aae3f6bbfd2c3920c71892e3))
* **notifications:** generate TASK_ASSIGNED notifications when creating collection task ([e23a196](https://github.com/zweien/docx-template-system/commit/e23a1966f6ba5c2ee4ad5f410dfdf5136d30b772))
* **notifications:** implement notification service with tests ([e4b591d](https://github.com/zweien/docx-template-system/commit/e4b591d518934faf884805e0640f80af9c3293dc))
* **page:** add batch generation wizard page ([ee2ca65](https://github.com/zweien/docx-template-system/commit/ee2ca65fa585b6442ea04edf9768fffd835ddc8b))
* parse {{#name}} block markers and update placeholder service ([1a60ef2](https://github.com/zweien/docx-template-system/commit/1a60ef2ddfdcaa49aab43411b37b40f730e9ba07))
* **phase2a:** add data record service and API routes ([40dde4c](https://github.com/zweien/docx-template-system/commit/40dde4c0301084819546b9ae75f3f05091eb0e47))
* **phase2a:** add data table detail page with record table ([2ccbfa2](https://github.com/zweien/docx-template-system/commit/2ccbfa2913d4c273c29f1faa35cbf74a7f1e749c))
* **phase2a:** add data table list page ([ada1d6b](https://github.com/zweien/docx-template-system/commit/ada1d6bbfe0e2578d79e8fd5dbbd5fdadb4342db))
* **phase2a:** add data table service and API routes ([421f34e](https://github.com/zweien/docx-template-system/commit/421f34ef0a38557976d1c80d97d640512e9c5603))
* **phase2a:** add data table types and validators ([a63a184](https://github.com/zweien/docx-template-system/commit/a63a184f3f1904c422e947e96ac395ed989c5604))
* **phase2a:** add DataTable, DataField, DataRecord models ([f2bfd29](https://github.com/zweien/docx-template-system/commit/f2bfd299bd82b2159e92495a81f7f6c8d064d424))
* **phase2a:** add dynamic record form for create/edit ([e7a8dfd](https://github.com/zweien/docx-template-system/commit/e7a8dfd63d10a0e862fcca0a1ca0c83596828929))
* **phase2a:** add Excel import/export functionality ([25e56bb](https://github.com/zweien/docx-template-system/commit/25e56bb0ff0f633fc8c25d7a2d2363caefb17834))
* **phase2a:** add field configuration page ([d68528e](https://github.com/zweien/docx-template-system/commit/d68528e3b64664861d57662884d96322a6ab190e))
* **phase2a:** add master data link to sidebar ([a6cdb21](https://github.com/zweien/docx-template-system/commit/a6cdb2101d503dcdd03f94268db7301b1d9a7944))
* **phase2a:** add relation field support ([48ab944](https://github.com/zweien/docx-template-system/commit/48ab94466bfbb91ceb17771686928f1def7c8a58))
* rebrand to IDRL填表系统 with new logo ([289ff69](https://github.com/zweien/docx-template-system/commit/289ff69eae2fbad718a33b6a7cbb5338e74df1a5))
* refactor RecordTable with view, filter, sort, and field config ([540c6de](https://github.com/zweien/docx-template-system/commit/540c6deb8297aced1dc5b2b90f921e1648b968cd))
* replace configure route with edit wizard route ([b90bbee](https://github.com/zweien/docx-template-system/commit/b90bbee1eaa714683e677b42370d1b28835a6366))
* replace filename column with version number in templates list ([cfc1dab](https://github.com/zweien/docx-template-system/commit/cfc1dabe8b81444d0488d5bb6a946d942ea3ef5d))
* scaffold project with dependencies, shadcn/ui, and config ([fe7d2d3](https://github.com/zweien/docx-template-system/commit/fe7d2d32eb680c380670beb4f4939337a3101ae7))
* **service:** add batch generation service ([45eb8b6](https://github.com/zweien/docx-template-system/commit/45eb8b6bcb5db6a04cb04a7dc78f81a5f876d8b6))
* **services:** add template relation and record filtering ([e304413](https://github.com/zweien/docx-template-system/commit/e304413714967bfa16ae67c8e5f80b26290cfb7a))
* show TABLE type placeholders in config table with column preview ([d04b1c6](https://github.com/zweien/docx-template-system/commit/d04b1c6cb3c97321c09dbd6938918382024fe115))
* support {{#name}}...{{/name}} block markers with row cloning ([4190dc6](https://github.com/zweien/docx-template-system/commit/4190dc66430d9d19f2f0985d3575ac91870c80ef))
* support Chinese placeholders, import wizard field creation, and bug fixes ([b448ca9](https://github.com/zweien/docx-template-system/commit/b448ca9acfb73d7008340ed783d409a48af16913))
* support docx choice fields ([680fcc7](https://github.com/zweien/docx-template-system/commit/680fcc771ae40e7d393e974423c04c7b95f0533b))
* sync relation subtable rows and inverse snapshots ([7bce424](https://github.com/zweien/docx-template-system/commit/7bce424a102e30b2dc34447a62e032aca301839c))
* **templates:** add data table relation section to template detail ([0393b0a](https://github.com/zweien/docx-template-system/commit/0393b0a449d59c7a91b4522c55927d44616a9ec5))
* **types:** add batch generation type definitions ([1acbddf](https://github.com/zweien/docx-template-system/commit/1acbddf16c2fce6bc089ec7ee2ace3fe7e91354f))
* **types:** add TemplateFieldMapping and extend updateTemplateSchema ([d238d36](https://github.com/zweien/docx-template-system/commit/d238d369b20be7cbe1e84d7f4879fa17fabcbbd1))
* **ui:** add basic UI components (Button, Card, Input, Badge) ([717044b](https://github.com/zweien/docx-template-system/commit/717044bd7dc77a30440e895fde0295cdcf52ba0e))
* **ui:** add batch generation button to template detail page ([ac0450c](https://github.com/zweien/docx-template-system/commit/ac0450c78ec607ca524d6a436fd47cf2c4795b06))
* **ui:** add ContextMenu component based on Base UI ([adb2c74](https://github.com/zweien/docx-template-system/commit/adb2c74c12000835c4c95c0a09598da6013ec1d4))
* **ui:** add design tokens CSS ([e82a274](https://github.com/zweien/docx-template-system/commit/e82a274279023b21ee39c702e613b4612c34ea6e))
* **ui:** add layout components (Header, Sidebar, PageContainer) ([cd64e3e](https://github.com/zweien/docx-template-system/commit/cd64e3e20c641899ac9e7864421eeaf0d54dfa43))
* **ui:** add unified exports ([39451b8](https://github.com/zweien/docx-template-system/commit/39451b8da9d92b84b01a63d256e554376985bfb9))
* **ui:** create idrl-ui package structure ([b70ee12](https://github.com/zweien/docx-template-system/commit/b70ee126534c6b6a5361e37131058327f555bbe1))
* **ui:** integrate idrl-ui into main application ([de8bd7d](https://github.com/zweien/docx-template-system/commit/de8bd7d70a2453bc6642013d418ad10c58df18fa))
* **ui:** make list page cards clickable for direct navigation ([c564567](https://github.com/zweien/docx-template-system/commit/c564567c9bc360140b52bfd9a78c478d034c6169))
* update frontend pages for PUBLISHED status and version display ([881b3d9](https://github.com/zweien/docx-template-system/commit/881b3d99d932264b5d4a237e01c53c0f48c81844))
* upgrade ai chat experience ([06c70b4](https://github.com/zweien/docx-template-system/commit/06c70b4a7f08f1dff3825635ec7be065d45cd927))
* use custom logo and favicon from desktop ([5a5ce57](https://github.com/zweien/docx-template-system/commit/5a5ce57f76f5b9d74a3bdaa82cfe6208b2278dc1))
* **utils:** add field mapping utility functions ([025d7de](https://github.com/zweien/docx-template-system/commit/025d7de3f43dd8c1ac02d9cb89768488ff7b2b75))
* **utils:** add file name builder utility ([3ad9213](https://github.com/zweien/docx-template-system/commit/3ad921363d9e12cb724dba7df085aeebbea2d2eb))
* **validator:** add ai-agent validation schemas ([eac9472](https://github.com/zweien/docx-template-system/commit/eac94726546c0d0a2e998f3b4e102ec3edb9e64e))
* **validators:** add batch generation input validation ([4383126](https://github.com/zweien/docx-template-system/commit/43831264195f4988bc1b96754a9198cf6978b78c))


### Bug Fixes

* 模板详情页窄屏下操作按钮改为纯图标显示 ([2e9f778](https://github.com/zweien/docx-template-system/commit/2e9f778a57cc8ef9d03a3603aea3f4869e8466be))
* 修复侧边栏路径前缀匹配导致多个导航项同时高亮 ([3acea8f](https://github.com/zweien/docx-template-system/commit/3acea8fd0cb83e48f65242fbf3aab7e437281839))
* adapt batch generation and export for table placeholder data ([59ebcdb](https://github.com/zweien/docx-template-system/commit/59ebcdb125428cf65c087ee548c8bb787de3ff41))
* add '一区TOP' to cas_partition_std SELECT options ([cfd5c7d](https://github.com/zweien/docx-template-system/commit/cfd5c7dcef2d99724e8a5f77fd0f2752bd456741))
* add generic placeholder PATCH endpoint for single-row editing ([07ae200](https://github.com/zweien/docx-template-system/commit/07ae200ca58b0d52bc821648da598399a9fba044))
* add GET handler for single view and refresh ViewSelector on change ([85518b6](https://github.com/zweien/docx-template-system/commit/85518b6df1598ebc6ab4fa091051d6d1fd26adbe))
* add missing useState import in use-debounce hook ([3658bed](https://github.com/zweien/docx-template-system/commit/3658bedb09697ddb82c07c5fd4bf96ca81e50fb3))
* add relation subtable label ([6af2d69](https://github.com/zweien/docx-template-system/commit/6af2d6965ac3490b83d5410de570a8f7740eb062))
* address code review issues in performance optimization ([8f51760](https://github.com/zweien/docx-template-system/commit/8f517600b096bc4d642c53c87eb69236db5b4802))
* address plan compliance issues ([796dc77](https://github.com/zweien/docx-template-system/commit/796dc77390f90eedf4fdcdb8c4b812611675471b))
* **agent2:** resolve critical and important code review issues ([69653b2](https://github.com/zweien/docx-template-system/commit/69653b2a38f8555005e62a196ed78cd2522ad4d7))
* **agent2:** support Chinese field labels in SQL filter and fix count aggregation ([7db0e18](https://github.com/zweien/docx-template-system/commit/7db0e1800134c434d6e3910866f8949775cf7eed))
* **ai-agent:** 修复编辑功能bug并完善错误处理 ([ac973f2](https://github.com/zweien/docx-template-system/commit/ac973f23986cab575b99540969eb0ae90a570962))
* **ai-agent:** 修复更新记录数据丢失问题 ([419a388](https://github.com/zweien/docx-template-system/commit/419a3882d415c071622617fc5eaa732cfc5832eb))
* **ai-agent:** add dotenv import to load DATABASE_URL ([bafec49](https://github.com/zweien/docx-template-system/commit/bafec496c29875558bb77a6e8fd03da36387c5b9))
* **ai-agent:** fix test type errors and error codes ([2d8807e](https://github.com/zweien/docx-template-system/commit/2d8807e917c086c92df5daeea91febdb22feedbd))
* **ai-agent:** use /v1 path for OpenAI compatible API ([a49c494](https://github.com/zweien/docx-template-system/commit/a49c494cec70b0d08b699abdf45bf4d85da85b2b))
* allow null values for optional field properties in data-table validator ([77ff112](https://github.com/zweien/docx-template-system/commit/77ff112d4d5bc0a72f14cc02e83ed8966beb41e7))
* **api:** add permission check to batch download, use static imports ([886bc42](https://github.com/zweien/docx-template-system/commit/886bc4293e2e6d91d34bfed7aa39828b677f0ce9))
* auto-disable nativeButton when Button render is a non-button element ([c056f66](https://github.com/zweien/docx-template-system/commit/c056f669b44506a8f7bb2c467ea3cc7595711c7b))
* avoid truncating relation option search ([68271d9](https://github.com/zweien/docx-template-system/commit/68271d903fd62d8570ddd31eca421ae24198396c))
* backfill inverse field key for relation subtables ([3b74b91](https://github.com/zweien/docx-template-system/commit/3b74b91b986f32813f1c3406d10de99d473fee04))
* **batch:** add templateId validation, fix async zip creation ([f86c2ab](https://github.com/zweien/docx-template-system/commit/f86c2ab66c3f400f183708f0e8cda547fc454a94))
* **batch:** fix file name variable replacement and add fields GET endpoint ([f693693](https://github.com/zweien/docx-template-system/commit/f693693744d3c991d9c72a8bc0e05714c6c6e801))
* center collapse button in collapsed sidebar ([ba60116](https://github.com/zweien/docx-template-system/commit/ba60116bb54f033231a646df544f3d478c0c08b6))
* clarify relation row invariants ([d7cf677](https://github.com/zweien/docx-template-system/commit/d7cf6773e765c4e31bddc36cec00ce17b2ebd2b0))
* **components:** fix useEffect deps, use useRef, add ARIA ([251f6dd](https://github.com/zweien/docx-template-system/commit/251f6dd22c65dcc8929a9b9f501ed7eb7dd4622a))
* copy idrl-ui styles locally to resolve build error ([07b7f26](https://github.com/zweien/docx-template-system/commit/07b7f26ffe318ec8f22e1f8705b9bac82a20acd5))
* correct ZodError handling in fields API ([50da625](https://github.com/zweien/docx-template-system/commit/50da625a16ad063e0ede79e15cc90475c69cf313))
* **data:** 修复字段配置表单滚动、反向关系显示和 Agent2 搜索字段匹配 ([96a7e4d](https://github.com/zweien/docx-template-system/commit/96a7e4dfe1c2566e1dea4cd1c102655f04d4cbaa))
* **data:** 修复字段配置持久化、行内编辑保存和 Grid 点击冲突 ([f0cbe26](https://github.com/zweien/docx-template-system/commit/f0cbe26da9645fce2d4ef229b6c40d8bec7df40b))
* **data:** avoid nested button in ViewSwitcher tooltip trigger ([5939283](https://github.com/zweien/docx-template-system/commit/59392835f2da357c349d48cbcb612742b8875916))
* **data:** convert dashboard layout chain to flex column for table scroll ([b5fd1be](https://github.com/zweien/docx-template-system/commit/b5fd1be3d79a568dc7aba607fac4afd1888b78ea))
* **data:** fix Kanban useMemo self-reference crash and Timeline label truncation ([b736d96](https://github.com/zweien/docx-template-system/commit/b736d9616328506d50ae3d02c4976e43da252daa))
* **data:** fix SYSTEM_TIMESTAMP, FORMULA editor, BOOLEAN normalization, and duplicate key warnings ([0dee1f6](https://github.com/zweien/docx-template-system/commit/0dee1f6ebb448dc253541ef116b8d40c3ca6aec5))
* **data:** fix TypeScript type errors in computeSummary ([ef6860e](https://github.com/zweien/docx-template-system/commit/ef6860e2d26fe77bca53bc7739c378bf5f3c3f1d))
* **data:** harden useTableData view switching and delete rollback ([ef6b431](https://github.com/zweien/docx-template-system/commit/ef6b431e2752542331dbdc0ff855bec5ac8527e1))
* **data:** persist Timeline config selections through currentConfig.viewOptions ([03b7d27](https://github.com/zweien/docx-template-system/commit/03b7d27229ba8b800d7734ced9bc7850ca914a4d))
* **data:** preserve view readiness on pagination and scoped sort clearing ([6c0d222](https://github.com/zweien/docx-template-system/commit/6c0d222fc6aad13bafefade56e8cde783e6104d3))
* **data:** prevent dropdown menu click from triggering card navigation ([eae8e37](https://github.com/zweien/docx-template-system/commit/eae8e37601693821e2da116b4e6635b648f4975b))
* **data:** resolve hooks order crash and empty filter causing 0 records ([a472233](https://github.com/zweien/docx-template-system/commit/a47223363499fce69a52d8ae5cdbaeb79690ecaf))
* **data:** resolve lint errors in grid-view.tsx ([70a207c](https://github.com/zweien/docx-template-system/commit/70a207cec62444453009e4f12e7dd61bea520315))
* **data:** restore formatCellValue date behavior ([f224ca0](https://github.com/zweien/docx-template-system/commit/f224ca0fe4c7395eecd3e9db66d455590b617da6))
* **data:** restore only failed deleted record in useTableData ([215cf2f](https://github.com/zweien/docx-template-system/commit/215cf2f39a824ae89511fc3fbdc0012590bc7d73))
* **data:** restore table scrolling broken by ContextMenu trigger wrapper ([41884f9](https://github.com/zweien/docx-template-system/commit/41884f9213d9ed170646a1ac05bf58b1b5fff81d))
* **db:** add onDelete constraints and OutputMethod enum to batch generation schema ([87a8c5a](https://github.com/zweien/docx-template-system/commit/87a8c5aa64988d2074492b587feea5c2e5fd37a1))
* exclude deleted source fields from inverse display fallback ([44ba974](https://github.com/zweien/docx-template-system/commit/44ba9743cbca772e3a43ac6ced26615d993efede))
* field edit form shows empty label and relation table fields not loading ([dd0557c](https://github.com/zweien/docx-template-system/commit/dd0557c32a863cd93fc0b401b24cff75bf493ee5))
* fix category/tag API response format and creation crash ([9ef982a](https://github.com/zweien/docx-template-system/commit/9ef982a7d36d564105f67be5c20d417fa7ec63da))
* fix data picker search functionality ([50ec749](https://github.com/zweien/docx-template-system/commit/50ec7499a2314d880d3b0b4a93df223d8f06e394))
* handle choice control lines and button render semantics ([ab7a823](https://github.com/zweien/docx-template-system/commit/ab7a8231cdaa0e73145c7c8ddb2631c394f8fa3c))
* handle whitespace in docx placeholder regex ([5c3b5cd](https://github.com/zweien/docx-template-system/commit/5c3b5cd2fb799021818bca544fe3ce0b7e6b02d5))
* harden relation snapshot syncing ([a011731](https://github.com/zweien/docx-template-system/commit/a011731396e2f7eaa03577312c07624cae95dfc6))
* harden relation subtable target search ([83a30a4](https://github.com/zweien/docx-template-system/commit/83a30a4766ecfba9c08651ed287a1d6c4fc71589))
* improve attachment picker and conversation history handling ([c7a8f53](https://github.com/zweien/docx-template-system/commit/c7a8f53c98e1478d436d5e7ed1d0f12de19deade))
* include data source fields in placeholder API response ([12a9ad0](https://github.com/zweien/docx-template-system/commit/12a9ad02853951150f30696fc448fa20be402115))
* increase template name font size in generate page ([0129dd9](https://github.com/zweien/docx-template-system/commit/0129dd9b1cf4f38fd35630aa8010c279da96fa7f))
* integrate version history dialog and fix template page issues ([f8fcbaf](https://github.com/zweien/docx-template-system/commit/f8fcbaf920916cc47db1ff9f0e30125c1d38b80b))
* lock persisted field structure in config form ([b98af75](https://github.com/zweien/docx-template-system/commit/b98af75395b9a98a3148e18075abc5cdc76d7791))
* make table card clickable and increase title font size ([b443826](https://github.com/zweien/docx-template-system/commit/b443826516464af04ea5a7c07f957782583a1b02))
* make view delete icon always visible instead of hover-only ([bcb29f6](https://github.com/zweien/docx-template-system/commit/bcb29f65131fc8a65c058ec70e81204f339a9d70))
* **notifications:** resolve lint warnings in test file - prefix unused vars with underscore ([e355466](https://github.com/zweien/docx-template-system/commit/e3554667c8045c139173940013280f48cb54a523))
* only preview inverse field for unsaved subtables ([1a6ac33](https://github.com/zweien/docx-template-system/commit/1a6ac33929124c4c13f4851297a121dac5f57f4b))
* pass columns and TABLE inputType to DynamicForm in fill page ([f075571](https://github.com/zweien/docx-template-system/commit/f075571f86cf7ad188c0ca768c06173f2ac6dc51))
* pass conversation history to LLM ([1e00f5f](https://github.com/zweien/docx-template-system/commit/1e00f5f140de707909b9d73edb177b8d50a3d59f))
* placeholder config table label width, save on step transition, inline edit ([2436553](https://github.com/zweien/docx-template-system/commit/2436553fd159b4cef93db848c6acb97c35e44bab))
* preserve dynamic table columns and merged cells ([169b1da](https://github.com/zweien/docx-template-system/commit/169b1da87788f41eee6ce84480af218a309747af))
* preserve inverse field metadata on update ([a1f969c](https://github.com/zweien/docx-template-system/commit/a1f969c641c72aa6815449a182c65bf79501b018))
* preserve relation subtable row reorder ([080a943](https://github.com/zweien/docx-template-system/commit/080a943df6f6e4bce4bc8dd6caa525f84e00d966))
* preserve TABLE placeholder columns when saving config ([a5bdb9f](https://github.com/zweien/docx-template-system/commit/a5bdb9f045627494f12c71b43755342868f38fe9))
* prevent TABLE placeholder columns from being lost on save ([0fb2817](https://github.com/zweien/docx-template-system/commit/0fb28178dbe7466d5340f88ef3227c714bad8c17))
* relation field display shows ID instead of name ([5a7ef2a](https://github.com/zweien/docx-template-system/commit/5a7ef2aa9e66825172c8f7aca2e3910e8368647a))
* remove duplicate Image import from lucide-react ([f034744](https://github.com/zweien/docx-template-system/commit/f03474472538d19cc1666b81c2f530ef01cccf21))
* remove non-existent TEXTAREA field type from search filter ([7903e3b](https://github.com/zweien/docx-template-system/commit/7903e3bf00d2e4bfae246999ffe0285421afa7b9))
* render TABLE type form data as table in record detail page ([1a2de8d](https://github.com/zweien/docx-template-system/commit/1a2de8d9ef35d8d9a5ca105556f6bf02a4468c3e))
* resolve description save error and add description to template detail page ([6e7755a](https://github.com/zweien/docx-template-system/commit/6e7755a337fb32b6ebf5f644e842be5ed79e5d03))
* resolve ESLint warnings and Select display issues ([d97edb2](https://github.com/zweien/docx-template-system/commit/d97edb2295b79e3eab5cf3e7dc69de35585ae7cd))
* resolve lint errors in performance optimization ([a3cc8e5](https://github.com/zweien/docx-template-system/commit/a3cc8e5e1f89790c2f7c1d2cb009836c94a50848))
* resolve TypeScript type errors in Phase 2a master data ([324add9](https://github.com/zweien/docx-template-system/commit/324add93cb560a27226172c9f5cf162a939de24e))
* responsive layout for template detail header on narrow screens ([636069c](https://github.com/zweien/docx-template-system/commit/636069c1dc7b060694da78a36b1629d8b0d593ba))
* restore dialog styles and theme tokens ([278914c](https://github.com/zweien/docx-template-system/commit/278914cea893f49390111d788e99d3ca123852e1))
* restore opaque ui surface tokens ([cd69e2f](https://github.com/zweien/docx-template-system/commit/cd69e2f36efa0f849945bf0ef09046099093b678))
* scan all tables for block markers even when no data provided ([21b41df](https://github.com/zweien/docx-template-system/commit/21b41dfc548c57c544d73dd4d40d096bf986862a))
* set inverse relation displayField to paper_title and refresh snapshots ([5df7abf](https://github.com/zweien/docx-template-system/commit/5df7abfd9cc2b713961b56d67ecf83c094ea897d))
* show only PUBLISHED count for non-admin dashboard stats ([a20fc47](https://github.com/zweien/docx-template-system/commit/a20fc47a31c055de9c139b4d6c9a7802d359976a))
* show table name and field label instead of raw values in source binding dialog ([537472f](https://github.com/zweien/docx-template-system/commit/537472f2f157edec479f449d2f587a5072b271a5))
* skip auto-parse placeholders in edit mode when no new file uploaded ([058ce5a](https://github.com/zweien/docx-template-system/commit/058ce5a9da86259a97fcabf28a2f436b2ad36407))
* support inverse relation cardinality ([3db15f1](https://github.com/zweien/docx-template-system/commit/3db15f1493377232b9b15b9754c1c1a5e31e5de3))
* sync forward-side snapshot when relation is deleted from inverse side ([80255c8](https://github.com/zweien/docx-template-system/commit/80255c86fa4dffbcf1e2159532f5c089a87d3667))
* tighten relation field locks ([0c2b5e6](https://github.com/zweien/docx-template-system/commit/0c2b5e69b5beb011c04b5ca2d7053b734d7128f8))
* tighten relation field sync and cache invalidation ([b7eabcd](https://github.com/zweien/docx-template-system/commit/b7eabcdc1f710795d534ea2bf5833acc1f0ae550))
* tighten relation subtable schema ([37ddfe1](https://github.com/zweien/docx-template-system/commit/37ddfe165b077160a38fd183326bcbcc0779f041))
* **ui:** add missing --color-foreground token ([3e1b55f](https://github.com/zweien/docx-template-system/commit/3e1b55fa6ff3b0169bbd1d5f1615a75fd7416d47))
* **ui:** fix TypeScript type errors in layout components ([b896932](https://github.com/zweien/docx-template-system/commit/b8969321110d188ed35f039789a1e6f23ea4d5fb))
* **ui:** remove duplicate primary color in tailwind.config ([f9d550e](https://github.com/zweien/docx-template-system/commit/f9d550e0539e314b93ee66d1d31120d3daa27bbc))
* unify font size and reduce card padding ([4f31233](https://github.com/zweien/docx-template-system/commit/4f3123382a8565294535b25927b72c2850f55efc))
* use img tag instead of next/image for logo ([9f13db1](https://github.com/zweien/docx-template-system/commit/9f13db1e42dae729fef3c1db8549345e06fe4b1a))
* **utils:** correct validateFieldMapping empty string handling ([ba82866](https://github.com/zweien/docx-template-system/commit/ba828665925e604f551aa9e85304bc1ff6662f2d))
* **utils:** prevent regex injection in file name builder ([7bce2fc](https://github.com/zweien/docx-template-system/commit/7bce2fc6cdd4d0132781fbeae28fd25e90408771))
* **validators:** import fieldMappingSchema, add type exports ([3b04f22](https://github.com/zweien/docx-template-system/commit/3b04f22113d02390cf9b8afa264897f9f9339451))
* version relation schema config ([07078e2](https://github.com/zweien/docx-template-system/commit/07078e246f73c35a1bb86830cfefa37ec08fcc41))
