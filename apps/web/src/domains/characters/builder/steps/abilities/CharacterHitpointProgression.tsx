import { Group, NumberInput, Stack, Text } from '@mantine/core'
import { characterProgressionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderReferencesDto
} from '@artificer-toolkit/schema/api/characters'
import type { SelectOption } from '#forms/utils/formUtils'
import type { CharacterFormValues } from '../../core/characterBuilder.types'
import { getHitpointAbilityModifier } from './characterAbilities'
import { formatSignedNumber } from './abilityFormatting'
import * as sharedStyles from '../../shared/builderShared.css'
import * as styles from './characterAbilities.css'

type HitpointLevel = CharacterFormValues['intent']['hitpoints']['levels'][number]

export function CharacterHitpointProgression({
  abilityOptions,
  character,
  classReferences,
  isManual,
  onChange,
  readOnly,
  resolvedAbilityScores,
  rows
}: {
  abilityOptions: SelectOption[]
  character: CharacterFormValues
  classReferences: CharacterBuilderReferencesDto['classes']
  isManual: boolean
  onChange: (rows: HitpointLevel[]) => void
  readOnly: boolean
  resolvedAbilityScores: CharacterBuilderPayloadDto['resolution']['summary']['abilities']
  rows: HitpointLevel[]
}) {
  const totalHitpoints = rows.reduce((total, row) => total + row.value, 0)
  const progression = characterProgressionCapabilityRegistry.require(character.systemId)

  return (
    <Stack gap='sm' className={`${sharedStyles.inlinePanel} ${styles.hitpointPanel}`}>
      <Group justify='space-between' align='center'>
        <Text fw={700}>Hit points</Text>
        <Text fw={700}>{`Maximum HP ${totalHitpoints}`}</Text>
      </Group>
      {rows.length === 0 ? (
        <Text className={sharedStyles.mutedText}>Add a class to calculate hit points.</Text>
      ) : (
        <table className={styles.hitpointTable}>
          <thead>
            <tr>
              <th scope='col'>Character level</th>
              <th scope='col'>Class level</th>
              <th scope='col'>{isManual ? 'Hit-die roll' : 'Hit die'}</th>
              <th scope='col'>Modifier</th>
              <th scope='col'>HP gained</th>
            </tr>
          </thead>
          {character.intent.classes.map((classRow) => {
            const classReference = classReferences.find((record) => record.id === classRow.classId)
            const classLabel = classReference?.label ?? classRow.classId
            const classRows = rows.filter((row) => row.classId === classRow.classId)
            const classSubtotal = classRows.reduce((total, row) => total + row.value, 0)
            const dieSides = progression.hitDieSize(classReference?.hitpoint?.dieConfig)
            const hitpointAbility = classReference?.hitpoint?.ability
            const abilityModifier = hitpointAbility
              ? getHitpointAbilityModifier({
                  ability: hitpointAbility,
                  character,
                  resolvedAbilityScores
                })
              : 0

            return (
              <tbody key={`hp-class-${classRow.classId}`} className={styles.hitpointClassGroup}>
                <tr className={styles.hitpointClassHeader}>
                  <th scope='rowgroup' colSpan={5}>
                    <span>{classLabel}</span>
                    {rows.length > 1 ? <span>{`${classSubtotal} HP`}</span> : null}
                  </th>
                </tr>
                {classRows.map((row) => {
                  const roll = row.rolls?.[0]?.value
                  const isStartingLevel = row.level === 1
                  const hitDieValue = dieSides
                    ? isStartingLevel
                      ? dieSides
                      : progression.hitDieAverage(dieSides)
                    : null
                  const abilityLabel = abilityOptions.find(
                    (option) => option.value === hitpointAbility
                  )?.label

                  return (
                    <tr key={`hp-${row.classId}-${row.classLevel}`} className={styles.hitpointRow}>
                      <td data-label='Character level'>{row.level}</td>
                      <td data-label='Class level'>{`${classLabel} ${row.classLevel}`}</td>
                      {!isManual || isStartingLevel ? (
                        <td data-label='Hit die'>
                          <Text component='span' fw={600}>
                            {hitDieValue === null
                              ? 'Unavailable'
                              : `${hitDieValue} (${isStartingLevel ? 'maximum' : 'average'})`}
                          </Text>
                        </td>
                      ) : (
                        <td data-label={dieSides ? `d${dieSides} roll` : 'Hit-die roll'}>
                          <NumberInput
                            hideControls
                            aria-label={dieSides ? `d${dieSides} roll` : 'Hit-die roll'}
                            min={1}
                            max={dieSides ?? undefined}
                            value={roll ?? ''}
                            disabled={readOnly || dieSides === null}
                            onChange={(value) => {
                              if (typeof value !== 'number' || !dieSides) return
                              const nextRoll = Math.min(dieSides, Math.max(1, Math.trunc(value)))
                              onChange(
                                rows.map((candidate) =>
                                  candidate === row
                                    ? {
                                        ...candidate,
                                        value: progression.hitPointGain({
                                          die: dieSides,
                                          characterLevel: row.level,
                                          fixed: false,
                                          roll: nextRoll,
                                          modifier: abilityModifier
                                        }),
                                        rolls: [{ die: dieSides, value: nextRoll }]
                                      }
                                    : candidate
                                )
                              )
                            }}
                          />
                        </td>
                      )}
                      <td data-label='Modifier'>{`${formatSignedNumber(abilityModifier)}${abilityLabel ? ` ${abilityLabel}` : ''}`}</td>
                      <td data-label='HP gained'>
                        <Text component='span' fw={700}>
                          {row.value}
                        </Text>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      )}
    </Stack>
  )
}
