import { useEffect, useState } from 'react'
import { Bot, ListRestart, RefreshCcw, Save, Trash2, Webhook } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getTelegramSettings, registerTelegramCommands, updateTelegramSettings } from '../lib/api.js'
import { formatApiError, formatDateTime } from '../lib/format.js'
import { AutoRefreshButton, Badge, Button, Checkbox, Field, Input, MetricCard, Panel, SectionHeader } from '../components/ui.jsx'
import { useAutoRefresh } from '../hooks/useAutoRefresh.js'

const COMPACT_INPUT_CLASS = 'min-h-[44px] rounded-[0.95rem] px-4 py-2.5 text-sm'

function StatusBadge({ runtime }) {
  if (!runtime?.enabled) {
    return <Badge tone="warning">Bot đang tắt</Badge>
  }

  if (runtime.lastError) {
    return <Badge tone="danger">Có lỗi runtime</Badge>
  }

  if (runtime.workerActive) {
    return <Badge tone="success">Bot đang chạy</Badge>
  }

  return <Badge tone="warning">Bot chưa active</Badge>
}

export default function TelegramView({ token }) {
  const [settings, setSettings] = useState(null)
  const [runtime, setRuntime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [registeringCommands, setRegisteringCommands] = useState(false)
  const [form, setForm] = useState({
    enabled: false,
    publicBaseUrl: '',
    botToken: '',
    clearBotToken: false,
  })
  const canRegisterCommands = Boolean(
    form.enabled
      && form.publicBaseUrl.trim()
      && !form.clearBotToken
      && (settings?.botTokenConfigured || form.botToken.trim()),
  )

  async function loadTelegramConfig({ showLoading = true, showError = true } = {}) {
    if (showLoading) {
      setLoading(true)
    }

    try {
      const response = await getTelegramSettings(token)
      setSettings(response.settings)
      setRuntime(response.runtime)
      setForm({
        enabled: Boolean(response.settings?.enabled),
        publicBaseUrl: response.settings?.publicBaseUrl || '',
        botToken: '',
        clearBotToken: false,
      })
      return response
    } catch (error) {
      if (showError) {
        toast.error(formatApiError(error))
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadInitialConfig() {
      setLoading(true)

      try {
        const response = await getTelegramSettings(token)
        if (cancelled) {
          return
        }

        setSettings(response.settings)
        setRuntime(response.runtime)
        setForm({
          enabled: Boolean(response.settings?.enabled),
          publicBaseUrl: response.settings?.publicBaseUrl || '',
          botToken: '',
          clearBotToken: false,
        })
      } catch (error) {
        if (!cancelled) {
          toast.error(formatApiError(error))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitialConfig()

    return () => {
      cancelled = true
    }
  }, [token])

  const refreshNow = useAutoRefresh(async () => {
    await loadTelegramConfig({
      showLoading: false,
      showError: false,
    })
  }, 10000)

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await updateTelegramSettings(token, {
        enabled: form.enabled,
        publicBaseUrl: form.publicBaseUrl,
        botToken: form.botToken || undefined,
        clearBotToken: form.clearBotToken,
      })
      setSettings(response.settings)
      setRuntime(response.runtime)
      setForm((current) => ({
        ...current,
        botToken: '',
        clearBotToken: false,
      }))
      toast.success('Đã cập nhật cấu hình Telegram bot')
    } catch (error) {
      toast.error(formatApiError(error))
      await loadTelegramConfig({
        showLoading: false,
        showError: false,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleRegisterCommands() {
    setRegisteringCommands(true)

    try {
      const response = await registerTelegramCommands(token)
      setRuntime(response.runtime)
      toast.success(`Đã đăng ký ${response.count} Telegram commands`)
    } catch (error) {
      toast.error(formatApiError(error))
      await loadTelegramConfig({
        showLoading: false,
        showError: false,
      })
    } finally {
      setRegisteringCommands(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Telegram"
        title="Telegram"
        tone="ocean"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <AutoRefreshButton onClick={refreshNow} />
            {loading ? <Badge tone="warning">Đang đồng bộ…</Badge> : null}
            <StatusBadge runtime={runtime} />
          </div>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Bot token"
          value={settings?.botTokenConfigured ? 'Đã lưu' : 'Chưa có'}
          helper={settings?.botTokenMasked || ''}
          icon={Bot}
          tone={settings?.botTokenConfigured ? 'accent' : 'warning'}
        />
        <MetricCard
          label="Webhook"
          value={runtime?.workerActive ? 'Active' : 'Idle'}
          helper={runtime?.lastWebhookRegisteredAt ? formatDateTime(runtime.lastWebhookRegisteredAt) : ''}
          icon={Webhook}
          tone={runtime?.workerActive ? 'accent' : 'warning'}
        />
        <MetricCard
          label="Outbox pending"
          value={String(runtime?.outbox?.pending || 0)}
          icon={RefreshCcw}
          tone={runtime?.outbox?.failed ? 'danger' : 'neutral'}
        />
        <MetricCard
          label="Lỗi gần nhất"
          value={runtime?.lastError ? 'Có lỗi' : 'Ổn định'}
          helper={runtime?.lastError || ''}
          icon={Save}
          tone={runtime?.lastError ? 'danger' : 'accent'}
        />
      </div>

      <Panel
        eyebrow="Admin"
        title="Thiết lập bot"
        tone="sage"
      >
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <Field label="Public base URL">
              <Input
                className={COMPACT_INPUT_CLASS}
                value={form.publicBaseUrl}
                onChange={(event) => setForm((current) => ({ ...current, publicBaseUrl: event.target.value }))}
                placeholder="https://mail.example.com"
              />
            </Field>
            <Field label="Bot token" hint={settings?.botTokenConfigured ? `Đang dùng ${settings.botTokenMasked}` : 'Chưa có token đã lưu'}>
              <Input
                type="password"
                className={COMPACT_INPUT_CLASS}
                value={form.botToken}
                onChange={(event) => setForm((current) => ({ ...current, botToken: event.target.value, clearBotToken: false }))}
                placeholder={settings?.botTokenConfigured ? 'Nhập token mới nếu muốn thay' : '123456:ABCDEF...'}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Checkbox
                label="Bật Telegram bot"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <Checkbox
                label="Xóa token đã lưu"
                checked={form.clearBotToken}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  clearBotToken: event.target.checked,
                  botToken: event.target.checked ? '' : current.botToken,
                }))}
              />
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[var(--line)] bg-white/72 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">Runtime</p>
            <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <p><span className="font-semibold text-[var(--ink)]">Webhook URL:</span> {runtime?.webhookUrl || 'Chưa đăng ký'}</p>
              <p><span className="font-semibold text-[var(--ink)]">Lần poll cuối:</span> {runtime?.lastPollAt ? formatDateTime(runtime.lastPollAt) : 'Chưa có'}</p>
              <p><span className="font-semibold text-[var(--ink)]">Lần gửi thành công cuối:</span> {runtime?.lastDeliveryAt ? formatDateTime(runtime.lastDeliveryAt) : 'Chưa có'}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="submit" size="sm" icon={Save} loading={saving}>
                Lưu cấu hình
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={ListRestart}
                disabled={!canRegisterCommands}
                loading={registeringCommands}
                onClick={handleRegisterCommands}
              >
                Đăng ký commands
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => setForm((current) => ({ ...current, enabled: false, clearBotToken: true, botToken: '' }))}
              >
                Tắt bot
              </Button>
            </div>
          </div>
        </form>
      </Panel>
    </div>
  )
}
