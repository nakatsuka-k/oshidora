import './style.css'

const DEFAULT_API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')

const app = document.querySelector('#app')

const state = {
  apiBase: DEFAULT_API_BASE,
  busy: false,
  error: '',
  tables: [],
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function loadSchema() {
  const base = state.apiBase.replace(/\/$/, '')
  if (!base) {
    state.error = 'API Base が未設定です'
    state.tables = []
    render()
    return
  }

  state.busy = true
  state.error = ''
  render()

  try {
    const res = await fetch(`${base}/dev/d1-schema`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = json?.message || json?.error || '取得に失敗しました'
      throw new Error(msg)
    }
    state.tables = Array.isArray(json.tables) ? json.tables : []
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e)
    state.tables = []
  } finally {
    state.busy = false
    render()
  }
}

function render() {
  const tableCards = state.tables
    .map((t) => {
      const cols = Array.isArray(t.columns) ? t.columns : []
      const columnsHtml = cols
        .map((c) => {
          const parts = []
          if (c?.type) parts.push(String(c.type).trim())
          if (Number(c?.notnull) === 1) parts.push('NOT NULL')
          if (Number(c?.pk) === 1) parts.push('PK')
          if (c?.dflt_value !== null && c?.dflt_value !== undefined && String(c.dflt_value).length > 0) {
            parts.push(`DEFAULT ${c.dflt_value}`)
          }
          const detail = parts.join(' ') || '—'
          return `
            <div class="row">
              <div class="row-left">
                <div class="label">${escapeHtml(c?.name ?? '')}</div>
                <div class="detail">${escapeHtml(detail)}</div>
              </div>
            </div>
          `
        })
        .join('')

      return `
        <section class="card">
          <div class="card-header">
            <div class="card-title">${escapeHtml(t.name)}</div>
            <div class="card-meta">${cols.length} columns</div>
          </div>
          ${t.sql ? `<pre class="mono">${escapeHtml(t.sql)}</pre>` : ''}
          <div class="table">
            ${columnsHtml || '<div class="empty">カラムがありません</div>'}
          </div>
        </section>
      `
    })
    .join('')

  app.innerHTML = `
    <div class="container">
      <header class="header">
        <div>
          <h1>Oshidora D1 Viewer</h1>
          <p class="subtitle">ローカル専用 / 認証なし</p>
        </div>
      </header>

      <section class="card">
        <div class="controls">
          <label class="field">
            <span>API Base</span>
            <input id="apiBaseInput" value="${escapeHtml(state.apiBase)}" placeholder="http://127.0.0.1:8787" />
          </label>
          <div class="actions">
            <button id="reloadBtn" ${state.busy ? 'disabled' : ''}>${state.busy ? '読込中…' : '再読み込み'}</button>
          </div>
        </div>
        <div class="hint">APIは <code>/dev/d1-schema</code> を参照します。</div>
        ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}
      </section>

      ${state.tables.length === 0 && !state.busy && !state.error ? '<div class="empty">テーブルがありません</div>' : ''}
      ${tableCards}
    </div>
  `

  const input = document.querySelector('#apiBaseInput')
  input?.addEventListener('change', (e) => {
    state.apiBase = e.target.value.trim()
  })
  input?.addEventListener('blur', () => {
    state.apiBase = input.value.trim()
    loadSchema()
  })

  const reloadBtn = document.querySelector('#reloadBtn')
  reloadBtn?.addEventListener('click', () => loadSchema())
}

render()
void loadSchema()
