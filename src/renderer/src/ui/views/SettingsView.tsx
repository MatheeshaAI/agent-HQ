import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Cpu, FolderCog, FolderOpen, KeyRound, Save, Trash2, UserRound } from 'lucide-react'
import type { SettingsUpdate, SettingsView as Settings } from '@shared/types'
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
        <ApiKey settings={settings} />
        <Profile settings={settings} />
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
