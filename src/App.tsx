import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

type User = {
  id: number
  name: string
  email: string | null
  created_at: string
  updated_at: string
}

const PAGE_SIZE = 10

// 接口返回的是 UTC ISO 时间，这里按本机时区渲染成 YYYY-MM-DD HH:mm:ss
function formatTime(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

// 把各种失败翻译成人能看懂的一句话：限流、邮箱重复、记录已删、后端没起
function describeError(e: unknown, fallback: string) {
  if (!axios.isAxiosError(e)) return fallback
  const status = e.response?.status
  const serverMsg = (e.response?.data as { message?: string } | undefined)?.message
  if (status === 429) return '请求太频繁了，等一分钟再操作'
  if (status === 409) return serverMsg || '这个邮箱已经被使用'
  if (status === 404) return serverMsg || '记录不存在，可能已被别人删除'
  if (!e.response) return '连不上后端：确认 backend-starter 里已经 npm run dev'
  return serverMsg || fallback
}

export default function App() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [editing, setEditing] = useState<{
    id: number
    name: string
    email: string
    updatedAt: string
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setEditing(null)
    try {
      const res = await axios.get<User[]>('/api/users', {
        params: { q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      })
      setUsers(res.data)
      const headerTotal = res.headers?.['x-total-count']
      const nextTotal = Number(headerTotal ?? res.data.length)
      setTotal(nextTotal)
      // 删数据 / 搜索后页码可能越界，自动回收到最后一页
      const maxPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
      if (page > maxPage) setPage(maxPage)
      setTip('')
    } catch (e) {
      setTip(describeError(e, '列表加载失败'))
    } finally {
      setLoading(false)
    }

    try {
      const stats = await axios.get<{ userCount: number }>('/api/stats')
      setUserCount(stats.data.userCount)
    } catch {
      setUserCount(null)
    }
  }, [q, page])

  useEffect(() => {
    load()
  }, [load])

  async function add() {
    const trimmed = name.trim()
    if (!trimmed || loading) return
    try {
      await axios.post('/api/users', { name: trimmed, email: email.trim() || null })
      setName('')
      setEmail('')
      // 新记录按 id 升序排在最后一页，加完直接跳过去，避免“点了新增没反应”
      const lastPage = Math.max(1, Math.ceil((total + 1) / PAGE_SIZE))
      const hadQuery = Boolean(q)
      setQ('')
      setQInput('')
      if (!hadQuery && page === lastPage) await load()
      else setPage(lastPage)
    } catch (e) {
      setTip(describeError(e, '新增失败'))
    }
  }

  async function saveEdit() {
    if (!editing) return
    const trimmed = editing.name.trim()
    if (!trimmed) {
      setTip('姓名不能为空')
      return
    }
    // 先读一次最新数据：如果 updated_at 变了，说明别人在这期间改过，问一下再覆盖
    try {
      const latest = await axios.get<{ updated_at: string }>(`/api/users/${editing.id}`)
      if (latest.data.updated_at !== editing.updatedAt) {
        if (!window.confirm('这条记录刚被别人改过，仍要用你这次的内容覆盖吗？')) {
          setEditing(null)
          await load()
          return
        }
      }
    } catch (e) {
      setEditing(null)
      setTip(describeError(e, '保存失败'))
      await load()
      return
    }

    try {
      await axios.put(`/api/users/${editing.id}`, {
        name: trimmed,
        email: editing.email.trim() || null,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setTip(describeError(e, '保存失败'))
    }
  }

  async function remove(id: number, displayName: string) {
    if (!window.confirm(`确定删除「${displayName}」吗？删除后无法恢复。`)) return
    try {
      await axios.delete(`/api/users/${id}`)
      await load()
    } catch (e) {
      setTip(describeError(e, '删除失败'))
    }
  }

  function search() {
    setPage(1)
    setQ(qInput.trim())
  }

  function resetSearch() {
    setQInput('')
    setQ('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 820 }}>
      <h1>前端 + 后端 + MySQL</h1>
      <p>React + Vite 请求 Express，Express 再读写 MySQL</p>
      {userCount !== null && <p style={{ color: '#555' }}>数据库里共 {userCount} 条用户记录</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search()
          }}
          placeholder="搜索姓名或邮箱"
          aria-label="搜索姓名或邮箱"
          style={{ padding: 6, minWidth: 200 }}
        />
        <button onClick={search} disabled={loading}>
          搜索
        </button>
        {(q || qInput) && (
          <button onClick={resetSearch} disabled={loading}>
            清空
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入姓名"
          aria-label="姓名"
          style={{ padding: 6 }}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱（可不填）"
          aria-label="邮箱"
          style={{ padding: 6, minWidth: 200 }}
        />
        <button onClick={add} disabled={loading}>
          新增
        </button>
        <button onClick={load} disabled={loading}>
          刷新
        </button>
      </div>

      {/* 读屏软件会把 role=alert 的内容立刻念出来，屏幕外的用户也能知道出错原因 */}
      {tip && (
        <p role="alert" style={{ color: 'crimson' }}>
          {tip}
        </p>
      )}
      {loading && (
        <p role="status" style={{ color: '#888' }}>
          加载中…
        </p>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>ID</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>姓名</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>邮箱</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>创建时间</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>更新时间</th>
            <th style={{ borderBottom: '1px solid #ddd' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) =>
            editing?.id === u.id ? (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    aria-label="编辑姓名"
                    style={{ padding: 4 }}
                  />
                </td>
                <td>
                  <input
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    aria-label="编辑邮箱"
                    style={{ padding: 4 }}
                  />
                </td>
                <td>{formatTime(u.created_at)}</td>
                <td>{formatTime(u.updated_at)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button onClick={saveEdit}>保存</button>
                  <button onClick={() => setEditing(null)}>取消</button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.email ?? '-'}</td>
                <td>{formatTime(u.created_at)}</td>
                <td>{formatTime(u.updated_at)}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() =>
                      setEditing({
                        id: u.id,
                        name: u.name,
                        email: u.email ?? '',
                        updatedAt: u.updated_at,
                      })
                    }
                  >
                    编辑
                  </button>
                  <button onClick={() => remove(u.id, u.name)}>删除</button>
                </td>
              </tr>
            )
          )}
          {!loading && users.length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: '#888', paddingTop: 8 }}>
                没有匹配的数据
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1}>
          上一页
        </button>
        <span>
          共 {total} 条 · 第 {page} / {totalPages} 页
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={loading || page >= totalPages}
        >
          下一页
        </button>
      </div>
    </main>
  )
}
