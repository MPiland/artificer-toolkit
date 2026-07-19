import { ActionIcon, Button, Tooltip } from '@mantine/core'
import clsx from 'clsx'
import type { AuthoringActionControlProps } from './authoringActionControl.types'
import {
  actionDensityAdapter,
  actionEmphasisAdapter,
  resolveActionAppearance
} from './authoringPresentationAdapter'
import { useAuthoringPresentationContext } from './useAuthoringPresentationContext'
import * as styles from './FormRenderer.css'

export function AuthoringActionControl({
  action,
  className,
  icon,
  onClick
}: AuthoringActionControlProps) {
  const destructive = action.type === 'collection.remove'
  const context = useAuthoringPresentationContext()
  const appearance = resolveActionAppearance(action.presentation, context)
  const emphasis = actionEmphasisAdapter[appearance.emphasis]
  const density = actionDensityAdapter[appearance.density]

  if (appearance.display === 'icon') {
    return (
      <Tooltip label={action.label} openDelay={500}>
        <ActionIcon
          aria-label={action.label}
          className={clsx(styles.authoringActionControl, className)}
          data-destructive={destructive || undefined}
          size={density.icon}
          type='button'
          variant={emphasis.variant}
          onClick={onClick}
        >
          {icon}
        </ActionIcon>
      </Tooltip>
    )
  }

  return (
    <Button
      aria-label={action.label}
      className={clsx(styles.authoringActionControl, className)}
      data-destructive={destructive || undefined}
      fullWidth={appearance.width === 'full'}
      leftSection={destructive && appearance.display === 'text' ? undefined : icon}
      size={density.button}
      type='button'
      variant={emphasis.variant}
      onClick={onClick}
    >
      {action.label}
    </Button>
  )
}
