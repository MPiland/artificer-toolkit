import { Button, Select, Text } from '@mantine/core'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type ProficiencyPanel = Extract<CharacterSheetPanelDto, { kind: 'DEFENSES' | 'PROFICIENCIES' }>

export function CharacterSheetProficiencyPanels({
  canRemove,
  canUpsert,
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onRemoveAdjustment
}: {
  canRemove: boolean
  canUpsert: boolean
  expectedVersion: number
  panel: ProficiencyPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onRemoveAdjustment: (
    adjustmentId: string | undefined,
    family: 'DEFENSE' | 'PROFICIENCY'
  ) => Promise<boolean>
}) {
  if (panel.kind === 'DEFENSES') {
    return (
      <>
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Current defenses</h3>
          <div className={inspectorEditorStyles.entries}>
            {panel.defenses.map((defense) => (
              <div
                className={inspectorEditorStyles.entry}
                key={`${defense.kind}:${defense.damageTypeId}`}
              >
                <div>
                  <Text fw={720}>{defense.label}</Text>
                  <Text className={inspectorShellStyles.muted}>{defense.sourceLabel}</Text>
                </div>
                {defense.adjustmentId && canRemove ? (
                  <Button
                    color='red'
                    disabled={pending}
                    size='xs'
                    variant='subtle'
                    onClick={() => void onRemoveAdjustment(defense.adjustmentId, 'DEFENSE')}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {!panel.defenses.length ? (
              <Text className={inspectorShellStyles.muted}>No active defenses.</Text>
            ) : null}
          </div>
        </section>
        {canUpsert ? (
          <section className={inspectorShellStyles.section}>
            <h3 className={inspectorShellStyles.sectionTitle}>Add defense</h3>
            <Select
              clearable
              data={panel.additionOptions.map((option) => ({
                value: `${option.defenseKind}:${option.damageTypeId}`,
                label: option.label
              }))}
              disabled={pending}
              placeholder='Choose a defense'
              searchable
              value={null}
              onChange={(value) => {
                const option = panel.additionOptions.find(
                  (candidate) => `${candidate.defenseKind}:${candidate.damageTypeId}` === value
                )
                if (!option) return
                void submitCommand({
                  type: 'UPSERT_SHEET_ADJUSTMENT',
                  expectedVersion,
                  adjustment: {
                    family: 'DEFENSE',
                    defenseKind: option.defenseKind,
                    damageTypeId: option.damageTypeId,
                    field: 'ADDITION',
                    value: true
                  }
                })
              }}
            />
          </section>
        ) : null}
      </>
    )
  }

  return (
    <>
      <section className={inspectorShellStyles.section}>
        <h3 className={inspectorShellStyles.sectionTitle}>Current training</h3>
        <div className={inspectorEditorStyles.entries}>
          {panel.proficiencies.map((proficiency) => (
            <div
              className={inspectorEditorStyles.entry}
              key={`${proficiency.kind}:${proficiency.targetId}`}
            >
              <div>
                <Text fw={720}>{proficiency.label}</Text>
                <Text className={inspectorShellStyles.muted}>
                  {proficiency.kind} · {proficiency.sourceLabel}
                </Text>
              </div>
              {proficiency.adjustmentId && canRemove ? (
                <Button
                  color='red'
                  disabled={pending}
                  size='xs'
                  variant='subtle'
                  onClick={() => void onRemoveAdjustment(proficiency.adjustmentId, 'PROFICIENCY')}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {!panel.proficiencies.length ? (
            <Text className={inspectorShellStyles.muted}>No training entries.</Text>
          ) : null}
        </div>
      </section>
      {canUpsert ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Add proficiency</h3>
          <Select
            clearable
            data={panel.additionOptions.map((option) => ({
              value: `${option.kind}:${option.targetId}`,
              label: `${option.label} · ${option.kind}`
            }))}
            disabled={pending}
            placeholder='Choose training'
            searchable
            value={null}
            onChange={(value) => {
              const option = panel.additionOptions.find(
                (candidate) => `${candidate.kind}:${candidate.targetId}` === value
              )
              if (!option) return
              void submitCommand({
                type: 'UPSERT_SHEET_ADJUSTMENT',
                expectedVersion,
                adjustment: {
                  family: 'PROFICIENCY',
                  proficiencyKind: option.kind,
                  targetId: option.targetId,
                  field: 'ADDITION',
                  value: true
                }
              })
            }}
          />
        </section>
      ) : null}
    </>
  )
}
