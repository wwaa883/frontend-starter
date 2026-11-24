import { test, expect } from '@playwright/test'

const uniqueName = () =>
  `e2e_${Date.now().toString().slice(-6)}_${Math.random().toString(36).slice(2, 5)}`

// 无论用例成功还是失败，都把本轮造的 e2e_ 数据清掉
test.afterEach(async ({ request }) => {
  const res = await request.get('/api/users?q=e2e_&limit=200')
  if (!res.ok()) return
  const list = await res.json()
  for (const user of list) {
    await request.delete(`/api/users/${user.id}`)
  }
})

test('首页渲染出表格、统计数与分页信息', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /前端 \+ 后端 \+ MySQL/ })).toBeVisible()
  await expect(page.getByText(/数据库里共 .* 条用户记录/)).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByText(/共 \d+ 条 · 第 \d+ \/ \d+ 页/)).toBeVisible()
})

test('新增 → 搜索 → 编辑 → 删除 一条完整链路', async ({ page }) => {
  const name = uniqueName()
  const renamed = `${name}_改`

  await page.goto('/')

  // 新增
  await page.getByPlaceholder('输入姓名').fill(name)
  await page.getByPlaceholder('邮箱（可不填）').fill('e2e@example.com')
  await page.getByRole('button', { name: '新增' }).click()

  // 用搜索把它捞出来（保证不受分页影响）
  await page.getByPlaceholder('搜索姓名或邮箱').fill(name)
  await page.getByRole('button', { name: '搜索' }).click()

  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText('e2e@example.com')

  // 编辑
  await row.getByRole('button', { name: '编辑' }).click()
  await page.getByLabel('编辑姓名').fill(renamed)
  await page.getByRole('button', { name: '保存' }).click()

  await page.getByPlaceholder('搜索姓名或邮箱').fill(renamed)
  await page.getByRole('button', { name: '搜索' }).click()
  await expect(page.locator('tbody tr', { hasText: renamed })).toBeVisible()

  // 删除（确认弹窗点“确定”）
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('tbody tr', { hasText: renamed }).getByRole('button', { name: '删除' }).click()

  await expect(page.locator('tbody tr', { hasText: renamed })).toHaveCount(0)
})

test('取消删除确认时数据保留', async ({ page }) => {
  const name = uniqueName()
  await page.goto('/')

  await page.getByPlaceholder('输入姓名').fill(name)
  await page.getByRole('button', { name: '新增' }).click()
  await page.getByPlaceholder('搜索姓名或邮箱').fill(name)
  await page.getByRole('button', { name: '搜索' }).click()

  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toBeVisible()

  page.once('dialog', (dialog) => dialog.dismiss())
  await row.getByRole('button', { name: '删除' }).click()

  // 取消后行还在
  await expect(page.locator('tbody tr', { hasText: name })).toBeVisible()

  // 收尾：确认删除，避免脏数据
  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('tbody tr', { hasText: name }).getByRole('button', { name: '删除' }).click()
  await expect(page.locator('tbody tr', { hasText: name })).toHaveCount(0)
})

test('姓名超长时后端拒绝并给出提示', async ({ page }) => {
  await page.goto('/')

  const tooLong = 'a'.repeat(51)
  await page.getByPlaceholder('输入姓名').fill(tooLong)
  await page.getByRole('button', { name: '新增' }).click()

  await expect(page.getByText(/name 最多 50 个字符/)).toBeVisible()
})
