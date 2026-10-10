import { Text } from '@mantine/core'
import type { RollRecordDto, RollRuleCheckDto } from '@artificer-toolkit/schema/api/rolls'
import { formatRollEvidence } from '#app/components/dice/dice.utils'
import { concentrationTriggerText } from '../ruleCheckCopy'

/** A roll the rules settled: what was checked, the dice against the DC, and the outcome. */
export function CampaignRuleCheckRoll({
  evidence,
  ruleCheck
}: {
  evidence: RollRecordDto['evidence']
  ruleCheck: RollRuleCheckDto
}) {
  if (ruleCheck.kind === 'D20_MODE_ADJUSTED') {
    return (
      <div>
        <Text>
          Rolled <strong>{evidence.total}</strong>
        </Text>
        <Text c='dimmed' size='xs'>
          {formatRollEvidence(evidence, ruleCheck)}
        </Text>
      </div>
    )
  }
  return (
    <div aria-label={`Concentration check for ${ruleCheck.actorLabel}`}>
      <Text size='sm'>Concentration check: {concentrationTriggerText(ruleCheck)}</Text>
      <Text>
        Rolled <strong>{ruleCheck.total}</strong> vs DC {ruleCheck.dc}{' '}
        <Text c='dimmed' component='span' size='sm'>
          ({formatRollEvidence(evidence)})
        </Text>
      </Text>
      <Text c={ruleCheck.outcome === 'LOST' ? 'red' : undefined} fw={600} size='sm'>
        {ruleCheck.outcome === 'KEPT' ? 'Concentration kept' : 'Concentration lost'}
      </Text>
    </div>
  )
}
