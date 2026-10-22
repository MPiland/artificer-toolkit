import { Checkbox, MultiSelect, Select, SimpleGrid } from '@mantine/core'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'
import { filterOptions, findOption } from '../../forms/utils/valueGuards'

type SenseCapability = SenseReusableDefinitionDocumentDto['capabilities'][number]

const channels: SenseCapability['channel'][] = ['VISUAL', 'AUDITORY', 'VIBRATION', 'NONVISUAL']
const accessGrades: SenseCapability['accessGrade'][] = ['DETECTED', 'LOCATED', 'PRECISE']
const satisfiedRequirements: SenseCapability['satisfies'] = ['DETECT', 'LOCATE', 'PRECISE', 'SEE']
const illuminationAccesses: SenseCapability['illuminationAccess'][] = [
  'BRIGHT_ONLY',
  'DIM',
  'ORDINARY_DARKNESS',
  'MAGICAL_DARKNESS',
  'IGNORE'
]
const obscurementAccesses: SenseCapability['obscurementAccess'][] = [
  'NONE',
  'LIGHT',
  'HEAVY',
  'IGNORE'
]
const physicalConstraints: SenseCapability['physicalConstraints'] = [
  'LINE_OF_EFFECT',
  'SHARED_SURFACE'
]

export function SenseDefinitionEditor({
  document,
  disabled,
  onChange
}: {
  document: SenseReusableDefinitionDocumentDto
  disabled: boolean
  onChange: (document: SenseReusableDefinitionDocumentDto) => void
}) {
  const capability = document.capabilities[0]!
  const update = (next: Partial<typeof capability>) =>
    onChange({
      ...document,
      capabilities: [{ ...capability, ...next }, ...document.capabilities.slice(1)]
    })

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Select
        disabled={disabled}
        data={channels}
        label='Channel'
        value={capability.channel}
        onChange={(value) => {
          const channel = findOption(channels, value)
          if (channel) update({ channel })
        }}
      />
      <Select
        disabled={disabled}
        data={accessGrades}
        label='Access grade'
        value={capability.accessGrade}
        onChange={(value) => {
          const accessGrade = findOption(accessGrades, value)
          if (accessGrade) update({ accessGrade })
        }}
      />
      <MultiSelect
        disabled={disabled}
        data={satisfiedRequirements}
        label='Requirements satisfied'
        value={capability.satisfies}
        onChange={(satisfies) =>
          update({ satisfies: filterOptions(satisfiedRequirements, satisfies) })
        }
      />
      <Select
        disabled={disabled}
        data={illuminationAccesses}
        label='Illumination access'
        value={capability.illuminationAccess}
        onChange={(value) => {
          const illuminationAccess = findOption(illuminationAccesses, value)
          if (illuminationAccess) update({ illuminationAccess })
        }}
      />
      <Select
        disabled={disabled}
        data={obscurementAccesses}
        label='Obscurement access'
        value={capability.obscurementAccess}
        onChange={(value) => {
          const obscurementAccess = findOption(obscurementAccesses, value)
          if (obscurementAccess) update({ obscurementAccess })
        }}
      />
      <MultiSelect
        disabled={disabled}
        data={physicalConstraints}
        label='Physical constraints'
        value={capability.physicalConstraints}
        onChange={(constraints) =>
          update({ physicalConstraints: filterOptions(physicalConstraints, constraints) })
        }
      />
      <Checkbox
        disabled={disabled}
        checked={capability.perceivesInvisible}
        label='Perceives invisible subjects'
        onChange={(event) => update({ perceivesInvisible: event.currentTarget.checked })}
      />
    </SimpleGrid>
  )
}
