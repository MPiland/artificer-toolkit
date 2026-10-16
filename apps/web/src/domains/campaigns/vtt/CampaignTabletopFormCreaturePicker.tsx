import { Select } from '@mantine/core'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'

/**
 * The Creature a filtered creature form (Polymorph) turns its target into, picked from the System's
 * creature list. The Worker checks the pick against the action's filter at cast, so a Creature the
 * action refuses is told apart there, not hidden here.
 */
export function CampaignTabletopFormCreaturePicker(props: {
  systemId: string
  value: string | null
  disabled: boolean
  onChange: (creatureId: string | null) => void
}) {
  const creatures = useContentCatalogue('CREATURE', { systemId: props.systemId })
  return (
    <Select
      aria-label='Creature form'
      comboboxProps={{ withinPortal: false }}
      data={(creatures.items ?? []).map((creature) => ({
        label: creature.label,
        value: creature.id
      }))}
      disabled={props.disabled}
      placeholder='Choose a creature'
      searchable
      value={props.value}
      onChange={props.onChange}
    />
  )
}
