import { SnapshotProvider } from './state/snapshot'
import { PagesProvider } from './state/pages'
import { Shell } from './ui/shell/Shell'
import { Splash } from './ui/shell/Splash'

export default function App(): JSX.Element {
  return (
    <SnapshotProvider fallback={<Splash />}>
      <PagesProvider>
        <Shell />
      </PagesProvider>
    </SnapshotProvider>
  )
}
