// Installs the mock bridge before the real renderer entry runs.
import { installMockApi } from './mockApi'

installMockApi(new URLSearchParams(location.search))
await import('../../src/renderer/src/main')
