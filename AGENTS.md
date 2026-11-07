# AI 代码风格约束 · 理财有数前端

适用于本仓库全部目录。更深层 `AGENTS.md` 优先；用户明确要求优先。修改前阅读本文件、相关源码及配置，以现有工具检查结果为准。

## 1. 技术与目录边界

- 技术栈：Vue 3、TypeScript、Vben 5、Ant Design Vue、Pinia、Vite、ECharts。
- 使用根 `package.json` 声明的 Node.js 范围和 `pnpm@11.16.0`；依赖由 `pnpm-workspace.yaml` 的 catalog 和 workspace 管理，不引入 npm/yarn 锁文件。
- 当前业务应用为 `apps/web-antd`，家庭资产位于 `src/views/finance/`，接口位于 `src/api/finance/assets.ts`，路由入口为 `src/router/routes/modules/dashboard.ts`。
- `apps/web-ele`、`web-naive`、`web-tdesign`、`web-antdv-next` 等为其他 UI 实现；业务修改不自动复制到这些应用。
- `packages/` 和 `internal/` 仅承载跨应用能力及工具链；单个资产页面的逻辑留在业务目录。
- 工作前检查 `git status --short`，保留已有修改；不手工编辑 `node_modules/`、`dist/`、`output/` 或无关锁文件。

## 2. TypeScript 与 Vue 风格

- Vue 组件使用 `<script setup lang="ts">` 和 Composition API，沿用同目录的模板及样式组织方式。
- 使用 2 空格、单引号、分号和 LF；`oxfmt.config.ts` 及其共享配置负责格式化，当前 `printWidth` 为 80。不要用手工排版覆盖格式器。
- 类型导入使用 `import type`；业务绝对导入使用 `#/`，同目录模块使用相对路径，共享能力通过已有 `@vben/*` 包导入。
- 导入分组与排序由现有 ESLint 配置决定；不新增平行的格式化配置或批量调整无关导入。
- 组件文件沿用小写短横线命名，如 `asset-account-records.vue`；组合函数文件使用 `use-*.ts`，导出函数使用 `useXxx`；变量和函数用 camelCase，类型用 PascalCase。
- 请求、响应及组件边界使用明确类型；区分可选字段与可空字段，不用 `any`、双重断言、`@ts-ignore` 或关闭规则掩盖类型错误。
- 派生状态优先 `computed`，`watch` 用于必要副作用；事件监听器、计时器及图表实例在组件卸载时清理。
- 页面负责交互编排，独立视图提取组件，带状态的复用逻辑提取 composable，纯计算提取普通 `.ts` 模块。不要把新功能持续塞入 `index.vue`、`edit.vue` 或 `shared.ts`。
- 修改已有大组件时围绕本次功能拆分；不为达成行数目标重写整个页面，也不为一行模板增加无用抽象。

## 3. 接口与状态处理

- API 调用集中在 `src/api/finance/assets.ts` 等对应业务 API 文件，通过 `#/api/request` 的 `requestClient` 发起。
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
