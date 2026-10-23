import { useEffect, useRef, useState } from 'react'
import { useSnapshot } from '../../state/snapshot'
import { HexLogo } from '../common/HexLogo'
import { ChatGlyph, PageGlyph, ShareGlyph, type IconComponent } from '../common/glyphs'
import { WindowControls } from './WindowControls'
import { UrlBar } from './UrlBar'
import { UserMenu } from './UserMenu'
import styles from './TopBar.module.css'

export function TopBar(): JSX.Element {
  const { stats, online, settings } = useSnapshot()
  const [adding, setAdding] = useState(false)
  const [roomsOpen, setRoomsOpen] = useState(false)
  const roomsRef = useRef<HTMLDivElement>(null)
  const active = settings.rooms.find((room) => room.id === settings.currentRoomId)

  useEffect(() => {
    if (!roomsOpen) return
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (!roomsRef.current?.contains(event.target as Node)) setRoomsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setRoomsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [roomsOpen])
  return (
    <header className={styles.bar}>
      <WindowControls />
      <div className={styles.brand}>
        <HexLogo size={42} />
        <div className={styles.brandText}>
          <div className={styles.brandName}>Agent HQ</div>
          <div className={styles.brandTagline}>AI Agent Office</div>
        </div>
      </div>
      <div className={styles.stats}>
        <StatChip icon={PageGlyph} value={stats.pages} label="Total Pages" />
        <StatChip icon={ChatGlyph} value={stats.topics} label="Topics" />
        <StatChip icon={ShareGlyph} value={stats.sources} label="Sources" />
      </div>
      <div className={styles.rooms} aria-label="Rooms" ref={roomsRef}>
        <button
          className={styles.roomActive}
          title={active?.name}
          aria-expanded={roomsOpen}
          aria-haspopup="menu"
          onClick={() => setRoomsOpen((open) => !open)}
        >
          {active?.name ?? 'Work'}
        </button>
        {roomsOpen && (
          <div className={styles.roomMenu} role="menu">
            {settings.rooms.filter((room) => room.id !== settings.currentRoomId).map((room) => (
              <button
                key={room.id}
                role="menuitem"
                onClick={() => {
                  setRoomsOpen(false)
                  void window.api.switchRoom(room.id)
                }}
              >
                {room.name}
              </button>
            ))}
          </div>
        )}
        <button
          className={styles.roomAdd}
          aria-label="Add room"
          onClick={() => setAdding(true)}
        >
          +
        </button>
      </div>
      <UrlBar />
      <div className={`${styles.system} ${online ? styles.systemOnline : styles.systemOffline}`} role="status">
        <span className={styles.systemDot} />
        {online ? 'System Online' : 'Offline'}
      </div>
      <UserMenu />
      {adding && (
        <form
          className={styles.roomPrompt}
          onSubmit={(event) => {
            event.preventDefault()
            const input = new FormData(event.currentTarget).get('name')
            if (typeof input === 'string' && input.trim()) {
              void window.api.addRoom(input).then(() => setAdding(false))
            }
          }}
        >
          <input
            name="name"
            autoFocus
            placeholder="Room name"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setAdding(false)
            }}
          />
          <button>Add</button>
          <button type="button" onClick={() => setAdding(false)}>×</button>
        </form>
      )}
    </header>
  )
}

interface StatChipProps {
  icon: IconComponent
  value: number
  label: string
}

function StatChip({ icon: Icon, value, label }: StatChipProps): JSX.Element {
  return (
    <div className={styles.stat}>
      <Icon size={22} className={styles.statIcon} />
      <div>
        <div className={styles.statValue}>{value.toLocaleString()}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  )
}
