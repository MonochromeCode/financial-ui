# 理财有数 · Financial UI

理财有数的 Web 前端，基于 Vue 3、TypeScript、Vben 5 和 Ant Design Vue，用于管理家庭资产、负债、成员和资产变化。

[后端仓库与完整部署说明](https://github.com/MonochromeCode/financial) · [家庭资产接口](https://github.com/MonochromeCode/financial/blob/main/financial-server/docs/assets.md)

## 页面预览

以下为本地运行的实际页面，账户和金额均为演示数据。

### 家庭资产首页

![家庭资产首页：总资产、净资产、负债率和月度变化](docs/images/assets-overview.jpg)

<details>
<summary>查看四笔钱配置与资产趋势</summary>

![四笔钱配置与资产趋势](docs/images/assets-trend.jpg)

</details>

<details>
<summary>查看资产更新页面</summary>

![按分类和成员更新资产余额](docs/images/assets-edit.jpg)

</details>

## 功能

- 家庭总览与成员筛选：资产、负债、净资产、负债率、月度变化。
- 五类资产编辑：流动资金、固定资产、投资理财、应收款、负债。
- 四笔钱配置、资产组成、趋势图、月历和更新明细。
- 家庭账本管理：家庭成员、查看权限、资产分类配置。
- 桌面与移动端 H5 适配、深浅主题、金额隐藏、编辑草稿恢复。

本仓库保留 Vben monorepo 结构，理财有数业务位于 `apps/web-antd`。当前提供家庭资产负债表功能，银行自动同步、日常消费流水和原生 App 尚未实现。

## 环境要求

| 工具 | 版本 |
| --- | --- |
| Node.js | `^22.18.0` 或 `^24.12.0`，推荐 Node.js 24 |
| pnpm | `11.16.0`，与 `packageManager` 保持一致 |
| 后端 | [financial](https://github.com/MonochromeCode/financial)，默认 `http://127.0.0.1:48080` |

## 启动

```shell
git clone https://github.com/MonochromeCode/financial-ui.git
cd financial-ui
pnpm install
pnpm --filter @vben/web-antd exec vite --mode development --port 5173
```

访问 <http://localhost:5173>。使用 `pnpm dev:antd` 时默认端口为 `5666`；终端输出的地址为准。

开发接口配置在 `apps/web-antd/.env.development`。如需覆盖，在同目录创建 Git 已忽略的 `.env.development.local`：

```dotenv
VITE_PORT=5173
VITE_BASE_URL=http://127.0.0.1:48080
VITE_GLOB_API_URL=/admin-api
```

先按后端 README 初始化数据库并启动服务。默认初始化账号为 `admin` / `admin123`，首次进入家庭资产页建立账本。演示数据通过后端 `script/seed-household-demo.ps1` 生成。

## 构建与检查

```shell
pnpm build:antd
pnpm --filter @vben/web-antd typecheck
pnpm exec vitest run apps/web-antd/src/views/finance/__tests__/shared.test.ts --dom
```

构建输出目录为 `apps/web-antd/dist`，部署前按环境配置 API 地址。

## 业务代码

```text
apps/web-antd/
├── public/logo.svg
└── src/
    ├── api/finance/assets.ts          家庭资产接口
    ├── router/routes/modules/dashboard.ts
    └── views/finance/
        ├── index.vue                 家庭资产首页
        ├── edit.vue                  更新家庭资产
        ├── manage.vue                家庭账本管理
        ├── asset-chart.vue           资产图表
        ├── shared.ts                 金额与共享逻辑
        └── finance.css               页面样式
```

| 页面         | 路由                     |
| ------------ | ------------------------ |
| 家庭资产首页 | `/dashboard/workspace`   |
| 更新家庭资产 | `/finance/assets/edit`   |
| 家庭账本管理 | `/finance/assets/manage` |

后端金额使用十进制字符串返回，前端即时汇总使用整数分。权限由后端校验，页面按当前用户的家庭范围展示数据。

## 许可与来源

基于 [yudao-ui-admin-vben](https://github.com/yudaocode/yudao-ui-admin-vben) 和 [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin) 开发，遵循 [MIT License](LICENSE)，保留上游版权声明。
