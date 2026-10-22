import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Cpu, FolderCog, FolderOpen, KeyRound, LogIn, Save, Trash2, UserRound } from 'lucide-react'
import type { ModelOption, ProviderId, SettingsUpdate, SettingsView as Settings } from '@shared/types'
import { useSnapshot } from '../../state/snapshot'
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
