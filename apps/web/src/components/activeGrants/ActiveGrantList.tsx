import { Button, Text } from '@mantine/core'
import type { ActiveGrantListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import { activeGrantLabel, activeGrantTimeLeft } from './activeGrantDisplay'
import * as styles from './ActiveGrantList.css'

/**
 * An actor's active grants with their source and time left (D99). Pass `onEnd` only for the GM, who
 * may end one by hand; every other viewer reads the list.
 */
export function ActiveGrantList({
  disabled,
  grants,
  label,
  onEnd
}: {
  disabled?: boolean
  grants: readonly ActiveGrantListingDto[]
  /** Names the list for assistive technology. */
  label: string
  onEnd?: (effectId: string) => void
}) {
  if (grants.length === 0) return null
  return (
    <ul aria-label={label} className={styles.list}>
      {grants.map((grant) => (
        <li key={grant.effectId} className={styles.item}>
          <Text size='xs'>
            {activeGrantLabel(grant)}
            <Text c='dimmed' component='span' size='xs'>
              {' · '}
              {activeGrantTimeLeft(grant)}
            </Text>
          </Text>
          {onEnd ? (
            <Button
              aria-label={`End ${activeGrantLabel(grant)}`}
              disabled={disabled}
              size='compact-xs'
              variant='default'
              onClick={() => onEnd(grant.effectId)}
            >
              End
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
