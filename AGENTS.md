# AI 代码风格约束 · 理财有数前端

适用于本仓库全部目录。更深层 `AGENTS.md` 优先；用户明确要求优先。修改前阅读本文件、相关源码及配置，以现有工具检查结果为准。

## 代码模板：system 页面与 API

以 `apps/web-antd/src/views/system/notice`、`system/user`、`system/role` 和 `src/api/system` 为代码风格模板。标准管理页面按以下方式组织：

| 文件 | 职责与参考 |
| --- | --- |
| `views/<模块>/<领域>/index.vue` | 列表查询、操作及弹窗编排，参考 `views/system/notice/index.vue` |
| `views/<模块>/<领域>/data.ts` | `useFormSchema`、`useGridFormSchema`、`useGridColumns`，参考 `views/system/notice/data.ts` |
| `views/<模块>/<领域>/modules/form.vue` | 新增/修改表单及提交，参考 `views/system/notice/modules/form.vue` |
| `views/<模块>/<领域>/modules/*.vue` | 独立业务操作，如用户导入、角色分配，不堆入列表页面 |
| `api/<模块>/<领域>/index.ts` | API 类型及具名请求函数，参考 `api/system/notice/index.ts` |

表内路径均相对于 `apps/web-antd/src/`。资产总览、图表及批量记账等专门交互按业务需求保留，同时沿用上述职责拆分和公共组件用法；更新规范本身不触发页面重写。

## 1. 技术与目录边界

- 技术栈：Vue 3、TypeScript、Vben 5、Ant Design Vue、Pinia、Vite、ECharts。
- 使用根 `package.json` 声明的 Node.js 范围和 `pnpm@11.16.0`；依赖由 `pnpm-workspace.yaml` 的 catalog 和 workspace 管理，不引入 npm/yarn 锁文件。
- 当前业务应用为 `apps/web-antd`，家庭资产位于 `src/views/finance/`，接口位于 `src/api/finance/assets.ts`，路由入口为 `src/router/routes/modules/dashboard.ts`。
- `apps/web-ele`、`web-naive`、`web-tdesign`、`web-antdv-next` 等为其他 UI 实现；业务修改不自动复制到这些应用。
- `packages/` 和 `internal/` 仅承载跨应用能力及工具链；单个资产页面的逻辑留在业务目录。
- 工作前检查 `git status --short`，保留已有修改；不手工编辑 `node_modules/`、`dist/`、`output/` 或无关锁文件。

## 2. TypeScript 与 Vue 风格

- Vue 组件使用 TypeScript、Composition API 和 `<script lang="ts" setup>`，与 `system` 模板一致，保持 script、template、必要样式的文件结构。
- 使用 2 空格、单引号、分号和 LF；`oxfmt.config.ts` 及其共享配置负责格式化，当前 `printWidth` 为 80。不要用手工排版覆盖格式器。
- 类型导入使用 `import type`；业务绝对导入使用 `#/`，同目录模块使用相对路径，共享能力通过已有 `@vben/*` 包导入。
- 导入分组与排序由现有 ESLint 配置决定；不新增平行的格式化配置或批量调整无关导入。
- 组件文件沿用小写短横线命名，如 `asset-account-records.vue`；组合函数文件使用 `use-*.ts`，导出函数使用 `useXxx`；变量和函数用 camelCase，类型用 PascalCase。
- 请求、响应及组件边界使用明确类型；区分可选字段与可空字段，不用 `any`、双重断言、`@ts-ignore` 或关闭规则掩盖类型错误。
- 派生状态优先 `computed`，`watch` 用于必要副作用；事件监听器、计时器及图表实例在组件卸载时清理。
- 页面负责交互编排，独立视图提取组件，带状态的复用逻辑提取 composable，纯计算提取普通 `.ts` 模块。不要把新功能持续塞入 `index.vue`、`edit.vue` 或 `shared.ts`。
- 修改已有大组件时围绕本次功能拆分；不为达成行数目标重写整个页面，也不为一行模板增加无用抽象。
- 事件处理函数沿用 `handleCreate`、`handleEdit`、`handleDelete`、`handleRefresh`、`handleExport` 等命名；API、schema 工厂和主要业务操作参考 `system` 添加简明中文说明。

## 3. 接口与状态处理

- 新增 API 按 `src/api/<模块>/<领域>/index.ts` 组织，以 `XxxApi` namespace 收拢领域类型，导出 `getXxxPage`、`getXxx`、`createXxx`、`updateXxx`、`deleteXxx` 等具名函数；通过 `#/api/request` 的 `requestClient` 发起。
- 既有资产 API 继续使用 `src/api/finance/assets.ts`；涉及迁移时同步更新所有导入并保持服务端契约，不能仅为了匹配 `system` 把旧接口地址改为 CRUD 路由。
- 分页沿用 `@vben/request` 的 `PageParam` / `PageResult<T>`；VxeGrid 的 `currentPage`、`pageSize` 转换为接口 `pageNo`、`pageSize`，不另建一套分页协议。
- 不在组件中另建 fetch/axios 客户端，不重复实现令牌刷新、租户头、响应解包及全局错误提示。
- API 文件保留服务端字段名及金额字符串类型；字段增删或含义变化同步核对后端和业务文档。
- 异步页面明确处理加载、空数据、失败、重试及保存状态；请求失败保留用户输入，提交期间防止重复操作。
- 成员或筛选项快速切换时，防止较早请求的结果覆盖当前选择；不要用固定延时协调刷新。
- 草稿按当前用户、租户及家庭隔离；保留已有恢复、版本冲突和 `requestId` 去重语义，不能把失败提示改成静默成功。
- 优先局部 `ref` / `computed` 和现有 composable；跨页面共享状态才考虑现有 Pinia store。

## 4. 金额、字典与权限

- 接口金额维持 `string | null`；记账汇总复用 `shared.ts` 的 `cents`、`decimal`，展示复用 `formatMoney`，金额隐私复用 `usePrivacy`。
- 禁止以 `Number`、`parseFloat`、浮点加减或 `toFixed` 作为金额计算链。图表几何计算需要数值时，仅在显示边界转换，不能将结果回写账本。
- 保留“待填写”与零余额区别；总资产不包含负债，净资产允许为负，总资产为零时不能产生无穷负债率。
- 模板、四笔钱、保险类型及历史标签通过 `context.options` 和 `use-asset-dictionaries.ts` 获取，不再维护一份硬编码选项。
- 停用字典项保留历史标签且禁止新选；固定资产分类代码用于计算，不随显示名称变化。
- 页面、图表 tooltip、放大视图、图片下载及 Excel 导出统一遵守金额隐私和当前筛选状态。
- UI 根据 `context` 控制可见及可编辑范围；不得为了方便展示请求或缓存无权查看的成员数据。
- 历史明细、月度比较、账户流向计算分别复用已有模块，不能在模板中复制一套业务公式。

## 5. 页面与样式

- 优先使用现有 Ant Design Vue、Vben 组件与图标，不为单个交互引入另一套组件库。
- 标准管理列表使用 `Page`、`useVbenVxeGrid`，通过 `data.ts` 提供查询 schema 与列配置；查询接入 `proxyConfig.ajax.query`，刷新使用 `gridApi.query()`。
- 标准编辑表单使用 `useVbenForm` 和 `useVbenModal`；父页用 `connectedComponent` 连接独立表单，`setData(...).open()` 传值，表单成功后发出 `success` 触发父页刷新。
- 表单提交先校验，再 `modalApi.lock()`，在 `finally` 中 `unlock()`；只有请求成功才关闭弹窗并提示成功，加载详情同样释放锁。
- 列表操作沿用 `TableAction`、`ACTION_ICON` 和 `auth` 权限标识；删除使用已有确认方式，通用操作文案优先 `$t('ui.actionTitle.*')` / `$t('ui.actionMessage.*')`，不复制整套按钮和确认逻辑。
- 系统字典组件使用 `DICT_TYPE`、`getDictOptions` 和 `CellDict`，注意值类型；家庭资产已有字典仍从 `context.options` 获取，复用同一后端来源，不另建硬编码选项。
- 家庭资产共享样式沿用 `finance.css` 和现有类名前缀；组件专属样式保持局部作用域，不污染全局标签或其他业务页面。
- 沿用现有主题变量及深浅主题，避免硬编码仅适合白底的颜色；同时检查桌面和移动端布局。
- 长表格、弹窗和图表处理溢出、空态与触控操作；按钮提供可理解的标签，重要状态不只依赖颜色。
- 用户文案沿用中文业务术语；技术报错不得直接作为成功提示或普通业务文案。

## 6. 验证与交付

以下命令在本仓库根目录执行，按实际改动选择：

```shell
# TypeScript / Vue 改动
pnpm --filter @vben/web-antd typecheck
# 金额、历史、字典或图表逻辑改动：可改为具体测试文件
pnpm exec vitest run apps/web-antd/src/views/finance/__tests__ --dom
# 打包、依赖、路由或资源集成改动
pnpm build:antd
```

- 格式及 lint 使用现有 Oxfmt、Oxlint、ESLint、Stylelint 配置，对本次文件执行对应检查；不因局部任务运行全库自动修复。
- 金额及权限相关逻辑变更应验证大额精度、零/空余额、负净资产、筛选、历史及隐私等受影响边界；优先扩展已有 `__tests__`。
- 页面交互修改需要检查受影响的正常、加载、失败和窄屏状态；无法实际运行时明确说明验证限制。
- 纯文档修改不要求跑类型检查、测试或构建。不得通过跳过规则或删除测试获得通过结果。
- 不自动提交或推送；交付时说明改动和实际验证结果，保留与本次无关的未提交修改。
