import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Bot, Check, Clock, Cpu, FolderCog, FolderOpen, KeyRound, LogIn, Save, Trash2, UserRound } from 'lucide-react'
import type { AgentDef, ModelOption, ProviderId, SettingsUpdate, SettingsView as Settings } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
import { ROOM_LABEL } from '../../state/rooms'
import { Button } from '../common/Button'
import { ViewFrame } from './ViewFrame'
import styles from './views.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

/** Saves a partial settings update and reports the outcome in one place. */
function useSave(): [(update: SettingsUpdate, okText: string) => Promise<boolean>, Status, boolean] {
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)
  const save = async (update: SettingsUpdate, okText: string): Promise<boolean> => {
    setBusy(true)
    try {
      await window.api.saveSettings(update)
      setStatus({ kind: 'ok', text: okText })
      return true
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Could not save settings' })
      return false
    } finally {
      setBusy(false)
    }
  }
  return [save, status, busy]
}

export function SettingsView(): JSX.Element {
  const { settings } = useSnapshot()
  return (
    <ViewFrame title="Settings" subtitle="Where your wiki lives and how the agents think">
      <div className={styles.settings}>
        <KnowledgeFolder settings={settings} />
        <ProviderSettings settings={settings} />
        <AgentSettings settings={settings} />
      </div>
    </ViewFrame>
  )
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }): JSX.Element {
  return (
    <section className={styles.settingsSection}>
      <div className={styles.settingsIntro}>
        <span className={styles.settingsIcon}>{icon}</span>
        <div>
          <h2 className={styles.settingsTitle}>{title}</h2>
          <p className={styles.settingsText}>{description}</p>
        </div>
      </div>
      <div className={styles.settingsControls}>{children}</div>
    </section>
  )
}

function StatusLine({ status }: { status: Status }): JSX.Element | null {
  if (!status) return null
  return <div className={status.kind === 'ok' ? styles.noticeOk : styles.noticeError}>{status.text}</div>
}

function KnowledgeFolder({ settings }: { settings: Settings }): JSX.Element {
  const [save, status, busy] = useSave()
  const change = async (): Promise<void> => {
    const dir = await window.api.chooseKnowledgeDir()
    if (dir && dir !== settings.knowledgeDir) await save({ knowledgeDir: dir }, 'Knowledge folder changed')
  }
  return (
    <Section
      icon={<FolderCog size={18} />}
      title="Knowledge folder"
      description="Holds raw/ (your sources, never modified) and wiki/ (Markdown pages the agents write). Point it at a synced folder to back it up."
    >
      <div className={styles.pathBox} title={settings.knowledgeDir}>
        {settings.knowledgeDir}
      </div>
      <div className={styles.buttonRow}>
        <Button icon={FolderCog} onClick={change} busy={busy}>
          Change…
        </Button>
        <Button variant="ghost" icon={FolderOpen} onClick={() => window.api.openPath(settings.knowledgeDir)}>
          Open
        </Button>
      </div>
      <StatusLine status={status} />
    </Section>
  )
}

function ApiKey({ settings }: { settings: Settings }): JSX.Element {
  const [key, setKey] = useState('')
  const [save, status, busy] = useSave()

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!key.trim()) return
    if (await save({ apiKey: key.trim() }, 'API key saved')) setKey('')
  }

  return (
    <Section
      icon={<KeyRound size={18} />}
      title="Claude API key"
      description="Used by the agents to read, extract, link and answer. It is stored locally and only ever sent to the Claude API."
    >
      <div className={styles.keyState}>
        {settings.apiKeySet ? (
          <span className={styles.keySaved}>
            <Check size={14} strokeWidth={2.6} /> Key saved
          </span>
        ) : (
          <span className={styles.keyMissing}>No key yet — ingestion and questions are paused</span>
        )}
      </div>
      <form className={styles.buttonRow} onSubmit={submit}>
        <input
          className={styles.field}
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={settings.apiKeySet ? 'Paste a new key to replace it' : 'sk-ant-…'}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" variant="primary" icon={Save} busy={busy} disabled={!key.trim()}>
          Save
        </Button>
        {settings.apiKeySet && (
          <Button type="button" variant="danger" icon={Trash2} disabled={busy} onClick={() => save({ apiKey: '' }, 'API key removed')}>
            Clear
          </Button>
        )}
      </form>
      <StatusLine status={status} />
    </Section>
  )
}

function Profile({ settings }: { settings: Settings }): JSX.Element {
  const [model, setModel] = useState(settings.model)
  const [name, setName] = useState(settings.userName)
  const [save, status, busy] = useSave()

  useEffect(() => setModel(settings.model), [settings.model])
  useEffect(() => setName(settings.userName), [settings.userName])

  const dirty = model.trim() !== settings.model || name.trim() !== settings.userName
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const update: SettingsUpdate = {}
    if (model.trim() && model.trim() !== settings.model) update.model = model.trim()
    if (name.trim() && name.trim() !== settings.userName) update.userName = name.trim()
    await save(update, 'Settings saved')
  }

  return (
    <Section icon={<Cpu size={18} />} title="Model and profile" description="The Claude model every agent uses, and the name shown in the top bar.">
      <form className={styles.fieldGrid} onSubmit={submit}>
        <label className={styles.fieldLabel}>
          <span>
            <Cpu size={13} /> Model
          </span>
          <input className={styles.field} value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        </label>
        <label className={styles.fieldLabel}>
          <span>
            <UserRound size={13} /> Your name
          </span>
          <input className={styles.field} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className={styles.buttonRow}>
          <Button type="submit" variant="primary" icon={Save} busy={busy} disabled={!dirty || !model.trim() || !name.trim()}>
            Save changes
          </Button>
        </div>
      </form>
      <StatusLine status={status} />
    </Section>
  )
}

const PROVIDERS: { id: ProviderId; name: string; mode: 'key' | 'cli' | 'acp' }[] = [
  { id: 'anthropic', name: 'Anthropic API', mode: 'key' },
  { id: 'claude-code', name: 'Claude subscription (Claude Code)', mode: 'cli' },
  { id: 'openai', name: 'OpenAI API', mode: 'key' },
  { id: 'openrouter', name: 'OpenRouter', mode: 'key' },
  { id: 'codex', name: 'Codex via ACP', mode: 'acp' },
  { id: 'opencode', name: 'OpenCode via ACP', mode: 'acp' },
  { id: 'antigravity', name: 'Antigravity CLI via ACP', mode: 'acp' },
  { id: 'kilocode', name: 'Kilo Code via ACP', mode: 'acp' },
  { id: 'acp', name: 'Custom ACP agent', mode: 'acp' }
]

type ScheduleMode = 'off' | 'interval' | 'daily'

/** Form state for one agent. Strings, so half-typed values are kept until they are valid. */
interface AgentDraft {
  name: string
  role: string
  prompt: string
  enabled: boolean
  mode: ScheduleMode
  everyMinutes: string
  at: string
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function draftOf(def: AgentDef): AgentDraft {
  return {
    name: def.name,
    role: def.role,
    prompt: def.prompt ?? '',
    enabled: def.enabled,
    mode: def.schedule?.mode ?? 'off',
    everyMinutes: String(def.schedule?.everyMinutes ?? 60),
    at: def.schedule?.at ?? '09:00'
  }
}

/** The agent with the draft applied, or an error message for the first invalid field. */
function applyDraft(def: AgentDef, draft: AgentDraft): AgentDef | string {
  const name = draft.name.trim()
  if (!name) return 'Give the agent a name'
  const next: AgentDef = { ...def, name, role: draft.role.trim(), prompt: draft.prompt.trim() || undefined, enabled: draft.enabled }
  if (def.kind !== 'room') {
    delete next.schedule
    return next
  }
  if (draft.mode === 'interval') {
    const minutes = Number(draft.everyMinutes)
    if (!Number.isInteger(minutes) || minutes < 1) return 'Enter a whole number of minutes (1 or more)'
    next.schedule = { mode: 'interval', everyMinutes: minutes }
  } else if (draft.mode === 'daily') {
    if (!TIME_PATTERN.test(draft.at)) return 'Enter a time as HH:MM'
    next.schedule = { mode: 'daily', at: draft.at }
  } else {
    next.schedule = { mode: 'off' }
  }
  return next
}

function AgentSettings({ settings }: { settings: Settings }): JSX.Element {
  const editable = settings.agentDefs.filter((def) => def.kind !== 'pipeline')
  return (
    <Section
      icon={<Bot size={18} />}
      title="Agents"
      description="Name, role and instructions for Chief and the room agents. Room agents run by hand or on a schedule; schedules start off."
    >
      <div className={styles.agentEditList}>
        {editable.map((def) => (
          <AgentEditor key={def.id} def={def} />
        ))}
      </div>
    </Section>
  )
}

function AgentEditor({ def }: { def: AgentDef }): JSX.Element {
  const [save, status, busy] = useSave()
  const [draft, setDraft] = useState<AgentDraft>(() => draftOf(def))
  const [error, setError] = useState('')
  // Reset the form when the saved agent changes, but not on every snapshot push while editing.
  const signature = JSON.stringify(def)
  useEffect(() => {
    setDraft(draftOf(def))
    setError('')
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  const isRoom = def.kind === 'room'
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(def))
  const update = (patch: Partial<AgentDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }))
    setError('')
  }

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const next = applyDraft(def, draft)
    if (typeof next === 'string') {
      setError(next)
      return
    }
    // Read the current list first: the agent list is saved whole, so a stale copy could undo another edit.
    const current = await window.api.getSettings()
    const agentDefs = current.agentDefs.map((item) => (item.id === def.id ? next : item))
    await save({ agentDefs }, `${next.name} saved`)
  }

  return (
    <form className={styles.agentEditor} onSubmit={submit}>
      <div className={styles.agentEditorHead}>
        <strong>{def.name}</strong>
        <span className={styles.muted}>
          {def.kind === 'chief' ? 'Chief' : `${ROOM_LABEL[def.room]} room`}
        </span>
        <label>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> Enabled
        </label>
      </div>
      <div className={styles.fieldGrid}>
        <label className={styles.fieldLabel}>
          <span>Name</span>
          <input className={styles.field} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className={styles.fieldLabel}>
          <span>Role</span>
          <input className={styles.field} value={draft.role} onChange={(e) => update({ role: e.target.value })} />
        </label>
      </div>
      <label className={styles.fieldLabel}>
        <span>Instructions</span>
        <textarea
          className={`${styles.field} ${styles.textarea}`}
          value={draft.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          rows={4}
          spellCheck={false}
        />
      </label>
      {isRoom && (
        <div className={styles.fieldGrid}>
          <label className={styles.fieldLabel}>
            <span>
              <Clock size={13} /> Schedule
            </span>
            <select className={styles.field} value={draft.mode} onChange={(e) => update({ mode: e.target.value as ScheduleMode })}>
              <option value="off">Off (run by hand)</option>
              <option value="interval">Every N minutes</option>
              <option value="daily">Daily at a time</option>
            </select>
          </label>
          {draft.mode === 'interval' && (
            <label className={styles.fieldLabel}>
              <span>Minutes</span>
              <input
                className={styles.field}
                type="number"
                min={1}
                step={1}
                value={draft.everyMinutes}
                onChange={(e) => update({ everyMinutes: e.target.value })}
              />
            </label>
          )}
          {draft.mode === 'daily' && (
            <label className={styles.fieldLabel}>
              <span>Time</span>
              <input className={styles.field} type="time" value={draft.at} onChange={(e) => update({ at: e.target.value })} />
            </label>
          )}
        </div>
      )}
      <div className={styles.buttonRow}>
        <Button type="submit" variant="primary" icon={Save} busy={busy} disabled={!dirty}>
          Save agent
        </Button>
      </div>
      {error && <div className={styles.noticeError}>{error}</div>}
      <StatusLine status={status} />
    </form>
  )
}

function ProviderSettings({ settings }: { settings: Settings }): JSX.Element {
  const [key, setKey] = useState('')
  const [providerId, setProviderId] = useState<ProviderId>(settings.providerId)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [command, setCommand] = useState(settings.command)
  const [args, setArgs] = useState(settings.args)
  const [model, setModel] = useState(settings.model)
  const [name, setName] = useState(settings.userName)
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadError, setLoadError] = useState('')
  const [save, status, busy] = useSave()
  useEffect(() => setProviderId(settings.providerId), [settings.providerId])
  useEffect(() => setBaseUrl(settings.baseUrl), [settings.baseUrl])
  useEffect(() => setCommand(settings.command), [settings.command])
  useEffect(() => setArgs(settings.args), [settings.args])
  useEffect(() => setModel(settings.model), [settings.model])
  useEffect(() => setName(settings.userName), [settings.userName])

  const selected = PROVIDERS.find((item) => item.id === providerId)!
  const changeProvider = (id: ProviderId): void => {
    setProviderId(id)
    setModels([])
    setModel('')
    if (id === 'codex') { setCommand('npx'); setArgs('["-y", "@agentclientprotocol/codex-acp"]') }
    else if (id === 'opencode') { setCommand('opencode'); setArgs('["acp"]') }
    else if (id !== settings.providerId) { setCommand(''); setArgs('') }
  }
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const update: SettingsUpdate = { providerId, model: model.trim(), baseUrl, command, args, userName: name.trim() }
    if (key.trim()) update.apiKey = key.trim()
    if (await save(update, 'Provider settings saved')) setKey('')
  }
  const loadModels = async (): Promise<void> => {
    setLoadError('')
    try {
      const update: SettingsUpdate = { providerId, baseUrl, command, args }
      if (key.trim()) update.apiKey = key.trim()
      if (!(await save(update, 'Provider connection saved'))) return
      setKey('')
      setModels(await window.api.listModels())
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not list models') }
  }

  return (
    <>
      <Section icon={<Cpu size={18} />} title="AI provider" description="Choose the provider for every agent. API credentials are stored separately per provider and encrypted when secure storage is available.">
        <form className={styles.fieldGrid} onSubmit={submit}>
          <label className={styles.fieldLabel}><span>Provider</span>
            <select className={styles.field} value={providerId} onChange={(event) => changeProvider(event.target.value as ProviderId)}>
              {PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
            </select>
          </label>
          {selected.mode === 'key' && <label className={styles.fieldLabel}><span><KeyRound size={13} /> API key {settings.configuredProviders.includes(providerId) ? '(saved)' : ''}</span>
            <input className={styles.field} type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={settings.configuredProviders.includes(providerId) ? 'Leave blank to keep saved key' : 'Paste API key'} autoComplete="off" spellCheck={false} />
          </label>}
          {(providerId === 'openai' || providerId === 'openrouter') && <label className={styles.fieldLabel}><span>API base URL (optional)</span>
            <input className={styles.field} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={providerId === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1'} />
          </label>}
          {(selected.mode === 'acp' || selected.mode === 'cli') && <>
            <label className={styles.fieldLabel}><span>Agent executable</span>
              <input className={styles.field} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={providerId === 'claude-code' ? 'claude' : 'ACP-compatible command'} />
            </label>
            {selected.mode === 'acp' && <label className={styles.fieldLabel}><span>Arguments (JSON array or quoted list)</span>
              <input className={styles.field} value={args} onChange={(event) => setArgs(event.target.value)} placeholder={'["acp"]'} />
            </label>}
            {providerId === 'claude-code' && <>
              <p className={styles.settingsText}>Sign in with your Claude account through Claude Code. Agent HQ uses that local login for subscription access.</p>
              <Button type="button" variant="ghost" icon={LogIn} onClick={() => window.api.openClaudeLogin()}>Sign in to Claude</Button>
            </>}
            {selected.mode === 'acp' && <p className={styles.settingsText}>The command must speak ACP over stdio. Configure the installed compatible agent and its arguments here.</p>}
          </>}
          <label className={styles.fieldLabel}><span><Cpu size={13} /> Model ID</span>
            <input className={styles.field} list="agent-hq-models" value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
            <datalist id="agent-hq-models">{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
          </label>
          <label className={styles.fieldLabel}><span><UserRound size={13} /> Your name</span>
            <input className={styles.field} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className={styles.buttonRow}>
            <Button type="button" variant="ghost" icon={Cpu} onClick={loadModels} busy={busy}>Load models</Button>
            <Button type="submit" variant="primary" icon={Save} busy={busy} disabled={!model.trim()}>Save provider</Button>
            {settings.configuredProviders.includes(providerId) && selected.mode === 'key' && <Button type="button" variant="danger" icon={Trash2} disabled={busy} onClick={() => save({ providerId, apiKey: '' }, 'Provider key removed')}>Clear key</Button>}
          </div>
          {loadError && <div className={styles.noticeError}>{loadError}</div>}
          {selected.mode === 'acp' && <p className={styles.settingsText}>Model discovery depends on the ACP agent. Enter a model ID manually when the agent has no model list.</p>}
          <StatusLine status={status} />
        </form>
      </Section>
    </>
  )
}
