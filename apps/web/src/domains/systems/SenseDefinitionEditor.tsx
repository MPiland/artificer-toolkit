import { Checkbox, MultiSelect, Select, SimpleGrid } from '@mantine/core'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'

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
        data={['VISUAL', 'AUDITORY', 'VIBRATION', 'NONVISUAL']}
        label='Channel'
        value={capability.channel}
        onChange={(value) => {
          if (value) update({ channel: value as typeof capability.channel })
        }}
      />
      <Select
        disabled={disabled}
        data={['DETECTED', 'LOCATED', 'PRECISE']}
        label='Access grade'
        value={capability.accessGrade}
        onChange={(value) => {
          if (value) update({ accessGrade: value as typeof capability.accessGrade })
        }}
      />
      <MultiSelect
        disabled={disabled}
        data={['DETECT', 'LOCATE', 'PRECISE', 'SEE']}
        label='Requirements satisfied'
        value={capability.satisfies}
        onChange={(satisfies) => update({ satisfies: satisfies as typeof capability.satisfies })}
      />
      <Select
        disabled={disabled}
        data={['BRIGHT_ONLY', 'DIM', 'ORDINARY_DARKNESS', 'MAGICAL_DARKNESS', 'IGNORE']}
        label='Illumination access'
        value={capability.illuminationAccess}
        onChange={(value) => {
          if (value) update({ illuminationAccess: value as typeof capability.illuminationAccess })
        }}
      />
      <Select
        disabled={disabled}
        data={['NONE', 'LIGHT', 'HEAVY', 'IGNORE']}
        label='Obscurement access'
        value={capability.obscurementAccess}
        onChange={(value) => {
          if (value) update({ obscurementAccess: value as typeof capability.obscurementAccess })
        }}
      />
      <MultiSelect
        disabled={disabled}
        data={['LINE_OF_EFFECT', 'SHARED_SURFACE']}
        label='Physical constraints'
        value={capability.physicalConstraints}
        onChange={(physicalConstraints) =>
          update({
            physicalConstraints: physicalConstraints as typeof capability.physicalConstraints
          })
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
