# frontend-starter

[![CI](https://github.com/wwa883/frontend-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/wwa883/frontend-starter/actions/workflows/ci.yml)

React 19 + Vite 8 + TypeScript 的最小前端，示例页面通过 `/api` 代理访问后端。

## 启动

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 打包到 dist/
npm run preview  # 预览打包结果
npm run lint     # ESLint 检查
npm run format   # Prettier 格式化
npm run test     # Vitest 跑单元/组件测试
npm run test:e2e # Playwright 端到端测试
```

## 页面功能

用户管理页（`src/App.tsx`）已经接上了后端的全部能力：

- **列表**：显示 ID / 姓名 / 邮箱 / 创建时间 / 更新时间，邮箱为空显示 `-`；时间按本机时区显示（接口给的是 UTC，前端负责换算，不会差 8 小时）
- **新增**：填姓名 + 可选邮箱，提交后自动跳到新记录所在的那一页并刷新
- **编辑**：点行内「编辑」直接把该行变成输入框，保存调 `PUT /api/users/:id`，取消回退
- **删除**：调 `DELETE /api/users/:id`，先 `confirm` 二次确认
- **搜索**：输入姓名或邮箱关键字，回车或点「搜索」，带 `?q=` 请求；「清空」回到全量
- **分页**：每页 10 条，页数按响应头 `X-Total-Count` 计算，上一页 / 下一页，数据变少自动回收到有效页
- **统计**：顶部显示 `/api/stats` 返回的总记录数
- **状态**：请求中显示「加载中…」并禁用按钮，防止重复提交；后端异常给出可读提示

## 测试

- **单元/组件测试**：`src/test/App.test.tsx`，10 个用例，axios 全 mock，不依赖真实后端；`vitest.config.ts` 固定 `TZ=Asia/Shanghai`，时间断言不受机器时区影响。
- **端到端测试**：`e2e/users.spec.ts`，4 个用例，需要真实后端（3000）+ 前端（5173）。`playwright.config.ts` 的 `webServer` 会把两个进程都拉起来（已在运行则复用）。
  - 默认用系统已装的 Edge（`channel: 'msedge'`），不额外下载浏览器；CI 或无 Edge 的机器上 `PW_CHANNEL=chromium npx playwright test`。
  - 每个用例结束后按 `q=e2e_` 清理自己造的数据，失败也不会留脏数据。

## 说明

- 开发服务器监听 `localhost:5173`（IPv6 回环），地址别写成 `127.0.0.1`。
- `vite.config.ts` 里把 `/api` 代理到 `http://localhost:3000`，所以页面里直接写 `/api/xxx` 即可。
- 想让手机或同局域网设备访问：`npm run dev -- --host`。
- 单元测试放在 `src/test/`，端到端测试放在 `e2e/`；`vitest` 的 `include` 只收 `src/**/*.test.{ts,tsx}`，不会误把 e2e 当单元测试跑。

## CI

`quality` 任务每次 push / PR 都跑：lint → test → build。

`e2e` 任务每次 push / PR 都跑：起 MySQL service、跨仓库检出后端（两个仓库都是 public，默认 `GITHUB_TOKEN` 即可读）、初始化库、起后端、装 Chromium、跑 Playwright。
