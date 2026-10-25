import { Alert, Select } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type { SystemListResponseDto } from '@artificer-toolkit/schema/api/systems'

/** The explicit state for a create route that has no System yet: the author picks one, which the route carries as `?system=`. */
export function SystemChoiceAlert({
  subjectPlural,
  systems
}: {
  subjectPlural: string
  systems: SystemListResponseDto
}) {
  const navigate = useNavigate()

  return (
    <Alert color='yellow'>
      {systems.length === 0 ? (
        `A system is required before creating ${subjectPlural}.`
      ) : (
        <Select
          label={`Choose the system for these ${subjectPlural}`}
          placeholder='Select a system'
          allowDeselect={false}
          data={systems.map((system) => ({ value: system.id, label: system.label }))}
          onChange={(system) => {
            if (system) void navigate({ to: '.', search: (previous) => ({ ...previous, system }) })
          }}
        />
      )}
    </Alert>
  )
}
