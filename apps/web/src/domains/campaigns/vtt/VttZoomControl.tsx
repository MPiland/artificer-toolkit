import { ActionIcon, TextInput, Tooltip } from '@mantine/core'
import { Minus, Plus, ZoomIn } from 'lucide-react'
import { useState } from 'react'
import { formatVttZoomPercent, parseVttZoomPercent, stepVttZoomScale } from './vttZoom.model'
import * as styles from './VttZoomControl.css'

export function VttZoomControl({
  scale,
  onChange
}: {
  scale: number
  onChange: (scale: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  function commitDraft() {
    const parsed = draft === null ? null : parseVttZoomPercent(draft)
    if (parsed !== null) onChange(parsed)
    setDraft(null)
  }

  return (
    <div aria-label='Zoom' className={styles.control} role='group'>
      <ZoomIn aria-hidden size={16} />
      <Tooltip label='Zoom out'>
        <ActionIcon
          aria-label='Zoom out'
          variant='default'
          onClick={() => onChange(stepVttZoomScale(scale, 'OUT'))}
        >
          <Minus aria-hidden size={16} />
        </ActionIcon>
      </Tooltip>
      <TextInput
        aria-label='Zoom percentage'
        className={styles.percent}
        inputMode='numeric'
        size='xs'
        value={draft ?? formatVttZoomPercent(scale)}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitDraft()
          if (event.key === 'Escape') setDraft(null)
        }}
      />
      <Tooltip label='Zoom in'>
        <ActionIcon
          aria-label='Zoom in'
          variant='default'
          onClick={() => onChange(stepVttZoomScale(scale, 'IN'))}
        >
          <Plus aria-hidden size={16} />
        </ActionIcon>
      </Tooltip>
    </div>
  )
}
