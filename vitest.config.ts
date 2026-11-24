import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // 只跑单元/组件测试，e2e 目录交给 Playwright
    include: ['./src/**/*.test.{ts,tsx}'],
    // 时间展示相关断言依赖固定时区，避免换台机器就跑挂
    env: { TZ: 'Asia/Shanghai' },
  },
})
