import { Popover, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Sparkles } from 'lucide-react'
import * as actionTableStyles from './actionTable.css'
import * as panelStyles from '../shared/panel.css'
import type { CharacterSheetActiveBonus } from './characterSheetActions.utils'

/**
 * A count of the dice active effects add to an action's rolls; hovering or pressing it lists them.
 * Renders nothing when no effect adds one.
 */
export function CharacterSheetActiveBonuses({
  bonuses
}: {
  bonuses: readonly CharacterSheetActiveBonus[]
}) {
  const [opened, { open, close }] = useDisclosure(false)
  if (bonuses.length === 0) return null
  const name = `${bonuses.length} active ${bonuses.length === 1 ? 'bonus' : 'bonuses'}`
  return (
    <Popover
      onDismiss={close}
      opened={opened}
      position='bottom-start'
      shadow='none'
      width={260}
      withinPortal
    >
      <Popover.Target>
        <button
          aria-expanded={opened}
          aria-label={name}
          className={actionTableStyles.activeBonusBadge}
          onClick={open}
          onMouseEnter={open}
          onMouseLeave={close}
          type='button'
        >
          <Sparkles aria-hidden size={10} />
          {bonuses.length}
        </button>
      </Popover.Target>
      <Popover.Dropdown onMouseEnter={open} onMouseLeave={close}>
        <ul aria-label={name} className={actionTableStyles.activeBonusList}>
          {bonuses.map((bonus) => (
            <li key={`${bonus.source}|${bonus.die}|${bonus.appliesTo}|${bonus.condition ?? ''}`}>
              <Text fw={700} size='sm'>
                {bonus.source}
              </Text>
              <Text size='sm'>
                {bonus.die} · {bonus.appliesTo}
              </Text>
              {bonus.condition ? (
                <Text className={panelStyles.muted} size='xs'>
                  {bonus.condition}
                </Text>
              ) : null}
            </li>
          ))}
        </ul>
      </Popover.Dropdown>
    </Popover>
  )
}
