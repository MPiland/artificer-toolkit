import { Select } from '@mantine/core'
import type { RulePackRevisionDto, RulePackSummaryDto } from '#app/lib/api'

export function RulePackNavigator({
  packs,
  revisions,
  packId,
  revisionId,
  onPackChange,
  onRevisionChange
}: {
  packs: RulePackSummaryDto[]
  revisions: RulePackRevisionDto[]
  packId: string | null
  revisionId: string | null
  onPackChange: (id: string | null) => void
  onRevisionChange: (id: string | null) => void
}) {
  return (
    <>
      <Select
        clearable
        data={packs.map((pack) => ({
          value: pack.id,
          label: `${pack.rulesetCode} ${pack.rulesetVersion}`
        }))}
        label='Pack'
        value={packId}
        onChange={onPackChange}
      />
      <Select
        data={revisions.map((item) => ({
          value: item.id,
          label: `r${item.revision} · ${item.lifecycle}`
        }))}
        disabled={!packId}
        label='Revision'
        value={revisionId}
        onChange={onRevisionChange}
      />
    </>
  )
}
