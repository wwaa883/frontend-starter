import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axios from 'axios'
import App from '../App'

vi.mock('axios')

const mockedAxios = vi.mocked(axios, true)

const rows = [
  {
    id: 1,
    name: '王奥',
    email: 'wwaa8833@163.com',
    created_at: '2026-11-23T12:34:18.000Z',
    updated_at: '2026-11-23T13:05:00.000Z',
  },
  {
    id: 2,
    name: '李雷',
    email: null,
    created_at: '2026-11-24T01:00:00.000Z',
    updated_at: '2026-11-24T02:00:00.000Z',
  },
]

function mockList(data = rows, total = data.length) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === '/api/stats') {
      return Promise.resolve({ data: { userCount: total }, headers: {} })
    }
    return Promise.resolve({ data, headers: { 'x-total-count': String(total) } })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App 用户表格', () => {
  it('渲染接口返回的用户列表、统计数与创建时间', async () => {
    mockList()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('王奥')).toBeInTheDocument()
    })
    expect(screen.getByText('李雷')).toBeInTheDocument()
    // 邮箱为空时显示占位符
    expect(screen.getByText('-')).toBeInTheDocument()
    // 接口给的是 UTC，界面按本机时区（测试固定 Asia/Shanghai）显示
    expect(screen.getByText('2026-11-23 20:34:18')).toBeInTheDocument()
    // 更新时间列
    expect(screen.getByText('2026-11-23 21:05:00')).toBeInTheDocument()
    // 统计接口的条数展示
    await waitFor(() => {
      expect(screen.getByText(/共 2 条用户记录/)).toBeInTheDocument()
    })
  })

  it('新增后自动跳到包含新记录的那一页', async () => {
    mockList(rows, 20)
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 21, name: '第21个人' } })

    render(<App />)
    await waitFor(() => expect(screen.getByText(/共 20 条 · 第 1 \/ 2 页/)).toBeInTheDocument())

    await userEvent.type(screen.getByPlaceholderText('输入姓名'), '第21个人')
    await userEvent.click(screen.getByText('新增'))

    // 21 条数据 → 第 3 页，新记录在 offset 20
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/users', {
        params: { q: undefined, limit: 10, offset: 20 },
      })
    })
  })

  it('按关键字搜索时把 q 传给后端', async () => {
    mockList()

    render(<App />)
    await waitFor(() => expect(screen.getByText('王奥')).toBeInTheDocument())

    await userEvent.type(screen.getByPlaceholderText('搜索姓名或邮箱'), 'wa')
    await userEvent.click(screen.getByText('搜索'))

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/users', {
        params: { q: 'wa', limit: 10, offset: 0 },
      })
    })
  })

  it('点击新增后会把姓名和邮箱发给后端', async () => {
    mockList([])
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 3, name: '新同学' } })

    render(<App />)
    await waitFor(() => expect(screen.getByText('没有匹配的数据')).toBeInTheDocument())

    await userEvent.type(screen.getByPlaceholderText('输入姓名'), '新同学')
    await userEvent.type(screen.getByPlaceholderText('邮箱（可不填）'), 'x@y.com')
    await userEvent.click(screen.getByText('新增'))

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/users', {
        name: '新同学',
        email: 'x@y.com',
      })
    })
  })

  it('编辑一行后保存会调用 PUT 接口', async () => {
    mockList()
    mockedAxios.put.mockResolvedValueOnce({ data: { id: 1, name: 'wa' } })

    render(<App />)
    await waitFor(() => expect(screen.getByText('王奥')).toBeInTheDocument())

    await userEvent.click(screen.getAllByText('编辑')[0])
    const nameInput = screen.getByLabelText('编辑姓名')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'wa')
    await userEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith('/api/users/1', {
        name: 'wa',
        email: 'wwaa8833@163.com',
      })
    })
  })

  it('分页按钮按 X-Total-Count 计算页数并请求下一页', async () => {
    mockList(rows, 25)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/共 25 条 · 第 1 \/ 3 页/)).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('下一页'))

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/users', {
        params: { q: undefined, limit: 10, offset: 10 },
      })
    })
  })

  it('删除前弹确认，确认后才调 DELETE', async () => {
    mockList()
    mockedAxios.delete.mockResolvedValueOnce({ status: 204 })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await waitFor(() => expect(screen.getByText('王奥')).toBeInTheDocument())

    await userEvent.click(screen.getAllByText('删除')[0])

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('王奥'))
    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/users/1')
    })
    confirmSpy.mockRestore()
  })

  it('取消确认时不发删除请求', async () => {
    mockList()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)
    await waitFor(() => expect(screen.getByText('王奥')).toBeInTheDocument())

    await userEvent.click(screen.getAllByText('删除')[0])

    expect(mockedAxios.delete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('总数变少导致页码越界时自动回收', async () => {
    let total = 21
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === '/api/stats') return Promise.resolve({ data: { userCount: total }, headers: {} })
      return Promise.resolve({ data: rows, headers: { 'x-total-count': String(total) } })
    })

    render(<App />)
    await waitFor(() => expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument())

    await userEvent.click(screen.getByText('下一页'))
    await userEvent.click(screen.getByText('下一页'))
    await waitFor(() => expect(screen.getByText(/第 3 \/ 3 页/)).toBeInTheDocument())

    // 数据被删到只剩 11 条 → 只该有 2 页，当前第 3 页应被收回
    total = 11
    await userEvent.click(screen.getByText('刷新'))

    await waitFor(() => expect(screen.getByText(/第 2 \/ 2 页/)).toBeInTheDocument())
  })

  it('后端不可用时给出提示', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Network Error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/后端没启动/)).toBeInTheDocument()
    })
  })
})
