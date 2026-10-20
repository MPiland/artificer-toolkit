import { Button } from '@mantine/core'
import { Maximize, Minimize } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Toggles this window's full screen. The browser only allows it from a click, so it is a button. */
export function CampaignTabletopFullscreenButton() {
  const [state, setState] = useState<'UNKNOWN' | 'UNSUPPORTED' | 'WINDOWED' | 'FULLSCREEN'>(
    'UNKNOWN'
  )

  useEffect(() => {
    const sync = () =>
      setState(
        !document.fullscreenEnabled
          ? 'UNSUPPORTED'
          : document.fullscreenElement
            ? 'FULLSCREEN'
            : 'WINDOWED'
      )
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  if (state === 'UNKNOWN' || state === 'UNSUPPORTED') return null
  const fullscreen = state === 'FULLSCREEN'

  return (
    <Button
      leftSection={
        fullscreen ? <Minimize aria-hidden size={16} /> : <Maximize aria-hidden size={16} />
      }
      size='xs'
      variant='default'
      onClick={() =>
        void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen())
      }
    >
      {fullscreen ? 'Exit full screen' : 'Full screen'}
    </Button>
  )
}
