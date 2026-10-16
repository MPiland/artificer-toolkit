import { NumberInput, Stack, Text } from '@mantine/core'

/**
 * How many projectiles (Magic Missile's darts) go to each creature. The picks are one entry per
 * projectile, so a creature's count is how often it appears; the total cannot pass `maxTargets`.
 */
export function CampaignTabletopProjectileTargets({
  creatures,
  disabled,
  maxTargets,
  value,
  onChange
}: {
  creatures: readonly { id: string; label: string }[]
  disabled: boolean
  maxTargets: number
  value: readonly string[]
  onChange: (actorIds: string[]) => void
}) {
  const countOf = (actorId: string) => value.filter((picked) => picked === actorId).length
  return (
    <Stack gap='xs'>
      <Text fw={600} size='sm'>
        {`Projectiles (${value.length} of ${maxTargets})`}
      </Text>
      {creatures.map((creature) => {
        const count = countOf(creature.id)
        return (
          <NumberInput
            key={creature.id}
            allowDecimal={false}
            allowNegative={false}
            clampBehavior='strict'
            disabled={disabled}
            label={creature.label}
            max={count + maxTargets - value.length}
            min={0}
            value={count}
            onChange={(next) =>
              onChange([
                ...value.filter((picked) => picked !== creature.id),
                ...Array<string>(Number(next) || 0).fill(creature.id)
              ])
            }
          />
        )
      })}
    </Stack>
  )
}
