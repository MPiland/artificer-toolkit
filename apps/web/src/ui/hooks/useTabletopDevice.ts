import { useSyncExternalStore } from 'react'

import { classifyTabletopDevice, type TabletopDeviceFit } from './tabletopDevice'

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  window.screen.orientation?.addEventListener('change', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
    window.screen.orientation?.removeEventListener('change', onChange)
  }
}

function getSnapshot(): TabletopDeviceFit {
  return classifyTabletopDevice({
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    viewportWidth: window.innerWidth
  })
}

/** `null` until the client has measured: the server cannot know the screen (D237). */
export function useTabletopDevice(): TabletopDeviceFit | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/** True only once measured on a device that can open the tabletop at all; entry controls show on it. */
export function useTabletopSupported(): boolean {
  const device = useTabletopDevice()
  return device !== null && device !== 'unsupported'
}
