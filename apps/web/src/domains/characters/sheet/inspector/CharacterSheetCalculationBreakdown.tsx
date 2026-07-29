import { Badge, Text } from '@mantine/core'

import type { CharacterSheetPanelNumericCalculationDto } from '#app/lib/api'
import { formatSigned } from '../core/characterSheet.utils'
import * as inspectorShellStyles from './inspectorShell.css'

export function CharacterSheetCalculationBreakdown({
  calculation
}: {
  calculation: CharacterSheetPanelNumericCalculationDto
}) {
  return (
    <div className={inspectorShellStyles.calculationList}>
      <div className={inspectorShellStyles.calculationRow}>
        <Text>Base value</Text>
        <Text fw={760}>{calculation.base}</Text>
      </div>
      {calculation.contributions.map((contribution) => (
        <div
          className={`${inspectorShellStyles.calculationRow} ${
            contribution.state === 'SUPPRESSED' ? inspectorShellStyles.suppressed : ''
          }`}
          key={contribution.id}
        >
          <div>
            <Text>{contribution.sourceLabel}</Text>
            {contribution.sourceNote ? (
              <Text className={inspectorShellStyles.muted}>{contribution.sourceNote}</Text>
            ) : null}
            {contribution.state === 'SUPPRESSED' ? (
              <Badge color='gray' size='xs' variant='light'>
                Suppressed
              </Badge>
            ) : null}
          </div>
          <Text fw={760}>{formatSigned(contribution.value)}</Text>
        </div>
      ))}
      {calculation.override ? (
        <div className={inspectorShellStyles.calculationRow}>
          <div>
            <Text>{calculation.override.sourceLabel}</Text>
            {calculation.override.sourceNote ? (
              <Text className={inspectorShellStyles.muted}>{calculation.override.sourceNote}</Text>
            ) : null}
            <Badge color='orange' size='xs' variant='light'>
              Absolute override
            </Badge>
          </div>
          <Text fw={760}>{calculation.override.value}</Text>
        </div>
      ) : null}
      <div className={inspectorShellStyles.calculationRow}>
        <Text fw={760}>Effective value</Text>
        <Text fw={800}>{calculation.effective}</Text>
      </div>
    </div>
  )
}
