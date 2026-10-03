import { SegmentedControl } from '@mantine/core'
import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'

const options: readonly { label: string; value: RollVisibilityDto }[] = [
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Private', value: 'PRIVATE' }
]

/** The GM's one Public/Private switch; it remembers the last choice on their profile. */
export function GmRollVisibilityToggle({ className }: { className?: string }) {
  const { gmRollVisibility, setGmRollVisibility } = useGmRollVisibilityPreference()

  return (
    <SegmentedControl
      aria-label='Roll visibility'
      className={className}
      data={[...options]}
      size='xs'
      value={gmRollVisibility}
      onChange={(next) =>
        setGmRollVisibility(
          options.find((option) => option.value === next)?.value ?? gmRollVisibility
        )
      }
    />
  )
}
