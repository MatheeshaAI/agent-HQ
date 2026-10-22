/// <reference types="vite/client" />
import type { AgentHqApi } from '@shared/types'

declare global {
  interface Window {
    api: AgentHqApi
  }
}
