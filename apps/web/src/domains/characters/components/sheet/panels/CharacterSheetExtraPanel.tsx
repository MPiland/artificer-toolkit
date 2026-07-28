import { Accordion, Badge, Button, MultiSelect, NumberInput, Switch, Text } from '@mantine/core'
import type { CharacterSheetPanelDto } from '#app/lib/api'
import { SIZE_REGISTRY, type SizeCode } from '@artificer-toolkit/shared/core'
import type { CharacterSheet } from '../CharacterSheet.types'
import type { SubmitSheetCommand } from '../CharacterSheet.types'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { getSheetAdjustmentMetadata } from './characterSheetInspector.model'
import { CharacterSheetTextEditor } from './CharacterSheetTextEditor'
import * as styles from './characterSheetInspector.css'

type ExtraPanel = Extract<CharacterSheetPanelDto, { kind: 'COMPANION' | 'VEHICLE' }>
type ExtraUpdate = {
  customName?: string | null
  notes?: string | null
  isActive?: boolean
  currentHitPoints?: number
  tempHitPoints?: number
  hitDice?: { die: number; total: number; used: number }[]
  equipmentItemIds?: string[]
}

function isSizeCode(value: string): value is SizeCode {
  return value in SIZE_REGISTRY
}

function ExtraFacts({ facts }: { facts: ExtraPanel['facts'] }) {
  return (
    <div className={styles.entries}>
      {facts.map((fact) => (
        <div className={styles.entry} key={`${fact.label}:${fact.value}`}>
          <Text>{fact.label}</Text>
          <Text fw={700}>{fact.value}</Text>
        </div>
      ))}
    </div>
  )
}

function ExtraReferenceList({
  empty,
  items
}: {
  empty: string
  items: ExtraPanel['actions'] | ExtraPanel['features']
}) {
  if (!items.length) return <Text className={styles.muted}>{empty}</Text>
  return (
    <div className={styles.entries}>
      {items.map((item) => (
        <div className={styles.entry} key={item.id}>
          <div>
            <Text fw={700}>{item.label}</Text>
            {item.description ? <Text className={styles.muted}>{item.description}</Text> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CharacterSheetExtraPanel({
  expectedVersion,
  equipmentItems,
  panel,
  pending,
  submitCommand,
  onClose
}: {
  expectedVersion: number
  equipmentItems: CharacterSheet['inventory']['items']
  panel: ExtraPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onClose: () => void
}) {
  const isCreature = panel.kind === 'COMPANION'
  const canUpdate = panel.editable && panel.allowedCommands.includes('UPDATE_EXTRA')
  const canRemove = panel.editable && panel.allowedCommands.includes('REMOVE_EXTRA')
  const canAdjust =
    isCreature &&
    panel.editable &&
    panel.allowedCommands.includes('UPSERT_ADJUSTMENT') &&
    panel.allowedCommands.includes('REMOVE_ADJUSTMENT')
  const canReset = panel.editable && panel.allowedCommands.includes('RESET_ADJUSTMENTS')
  const canUseResource = panel.editable && panel.allowedCommands.includes('USE_RESOURCE')
  const canRecoverResource = panel.editable && panel.allowedCommands.includes('RECOVER_RESOURCE')
  function update(extra: ExtraUpdate) {
    if (isCreature) {
      return submitCommand({
        type: 'UPDATE_SHEET_EXTRA',
        expectedVersion,
        extra: { kind: panel.relationshipKind, extraId: panel.companionInstanceId, ...extra }
      })
    }
    const { hitDice: _hitDice, tempHitPoints: _tempHitPoints, ...vehicleExtra } = extra
    return submitCommand({
      type: 'UPDATE_SHEET_EXTRA',
      expectedVersion,
      extra: { kind: 'VEHICLE', extraId: panel.vehicleInstanceId, ...vehicleExtra }
    })
  }

  async function remove() {
    if (!window.confirm(`Remove ${panel.displayName} from this character?`)) return
    const extra = isCreature
      ? { kind: panel.relationshipKind, extraId: panel.companionInstanceId }
      : { kind: 'VEHICLE' as const, extraId: panel.vehicleInstanceId }
    if (await submitCommand({ type: 'REMOVE_SHEET_EXTRA', expectedVersion, extra })) onClose()
  }

  return (
    <div className={styles.inspector}>
      <section className={styles.section}>
        <div className={styles.summary}>
          <div>
            <Text className={styles.summaryLabel}>
              {isCreature ? panel.relationshipLabel : 'Vehicle type'}
            </Text>
            <Text className={styles.summaryValue}>{panel.displayName}</Text>
            {panel.displayName !== panel.authoredName ? (
              <Text className={styles.muted}>{panel.authoredName}</Text>
            ) : null}
          </div>
          <div className={styles.badges}>
            {isCreature ? (
              <Badge variant='light'>{panel.originLabel}</Badge>
            ) : (
              <Badge variant='light'>{panel.categoryLabel}</Badge>
            )}
            {!panel.isActive ? (
              <Badge color='gray' variant='light'>
                Inactive
              </Badge>
            ) : null}
          </div>
        </div>
        <Switch
          checked={panel.isActive}
          disabled={pending || !canUpdate}
          label='Active on sheet'
          onChange={(event) => void update({ isActive: event.currentTarget.checked })}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Play state</h3>
        <NumberInput
          clampBehavior='strict'
          defaultValue={panel.hitPoints.current}
          disabled={pending || !canUpdate}
          label='Current hit points'
          min={0}
          onBlur={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (
              Number.isInteger(nextValue) &&
              nextValue >= 0 &&
              nextValue !== panel.hitPoints.current
            ) {
              void update({ currentHitPoints: nextValue })
            }
          }}
        />
        {isCreature ? (
          <>
            <NumberInput
              clampBehavior='strict'
              defaultValue={panel.hitPoints.temp}
              disabled={pending || !canUpdate}
              label='Temporary hit points'
              min={0}
              onBlur={(event) => {
                const nextValue = Number(event.currentTarget.value)
                if (
                  Number.isInteger(nextValue) &&
                  nextValue >= 0 &&
                  nextValue !== panel.hitPoints.temp
                ) {
                  void update({ tempHitPoints: nextValue })
                }
              }}
            />
            <div className={styles.entries}>
              {panel.hitDice.map((die) => (
                <div className={styles.entry} key={die.die}>
                  <div>
                    <Text>d{die.die} hit dice</Text>
                    <Text fw={700}>
                      {die.remaining} / {die.total}
                    </Text>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      disabled={pending || !canUpdate || die.used <= 0}
                      size='xs'
                      variant='default'
                      onClick={() =>
                        void update({
                          hitDice: panel.hitDice.map((candidate) =>
                            candidate.die === die.die
                              ? {
                                  die: candidate.die,
                                  total: candidate.total,
                                  used: candidate.used - 1
                                }
                              : { die: candidate.die, total: candidate.total, used: candidate.used }
                          )
                        })
                      }
                    >
                      Restore
                    </Button>
                    <Button
                      disabled={pending || !canUpdate || die.used >= die.total}
                      size='xs'
                      variant='default'
                      onClick={() =>
                        void update({
                          hitDice: panel.hitDice.map((candidate) =>
                            candidate.die === die.die
                              ? {
                                  die: candidate.die,
                                  total: candidate.total,
                                  used: candidate.used + 1
                                }
                              : { die: candidate.die, total: candidate.total, used: candidate.used }
                          )
                        })
                      }
                    >
                      Use
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
        <Text className={styles.muted}>Maximum hit points: {panel.hitPoints.maximum}</Text>
      </section>

      {isCreature ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Resources</h3>
          {panel.resources.length ? (
            <div className={styles.entries}>
              {panel.resources.map((resource) => (
                <div className={styles.entry} key={JSON.stringify(resource.target.owner)}>
                  <div>
                    <Text fw={700}>{resource.label}</Text>
                    <Text className={styles.muted}>
                      {resource.remaining} / {resource.maximum} remaining
                    </Text>
                  </div>
                  <div className={styles.actions}>
                    <Button
                      disabled={
                        pending ||
                        !canRecoverResource ||
                        resource.remaining >= resource.maximum ||
                        !resource.recoveries.some((recovery) => recovery.trigger === 'MANUAL')
                      }
                      size='xs'
                      variant='default'
                      onClick={() =>
                        void submitCommand({
                          type: 'RECOVER_SHEET_RESOURCE',
                          expectedVersion,
                          owner: resource.target.owner,
                          trigger: 'MANUAL'
                        })
                      }
                    >
                      Restore
                    </Button>
                    <Button
                      disabled={pending || !canUseResource || resource.remaining <= 0}
                      size='xs'
                      variant='default'
                      onClick={() =>
                        void submitCommand({
                          type: 'USE_SHEET_RESOURCE',
                          expectedVersion,
                          owner: resource.target.owner
                        })
                      }
                    >
                      Use
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Text className={styles.muted}>No feature resources are available.</Text>
          )}
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Details</h3>
        <ExtraFacts facts={panel.facts} />
        <MultiSelect
          data={equipmentItems.map((item) => ({ value: item.id, label: item.label }))}
          disabled={pending || !canUpdate}
          label='Assigned equipment'
          searchable
          value={panel.equipmentItemIds}
          onChange={(equipmentItemIds) => void update({ equipmentItemIds })}
        />
      </section>

      {isCreature && canAdjust ? (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Customize</h3>
          {panel.numericEditors.map((editor) => (
            <CharacterSheetAdjustmentEditor
              editor={editor}
              key={editor.field}
              pending={pending}
              onClear={async () =>
                await submitCommand({
                  type: 'REMOVE_SHEET_ADJUSTMENT',
                  adjustmentId: editor.adjustmentId ?? '',
                  family: 'COMPANION',
                  target: panel.target,
                  expectedVersion
                })
              }
              onCommit={async (commit) =>
                await submitCommand({
                  type: 'UPSERT_SHEET_ADJUSTMENT',
                  expectedVersion,
                  adjustment: {
                    ...getSheetAdjustmentMetadata(editor.adjustmentId, commit),
                    family: 'COMPANION',
                    companionInstanceId: panel.companionInstanceId,
                    field: editor.field,
                    value: Number(commit.value)
                  }
                })
              }
            />
          ))}
          {panel.selectEditors.map((editor) => (
            <CharacterSheetAdjustmentEditor
              editor={editor}
              key={editor.field}
              pending={pending}
              onClear={async () =>
                await submitCommand({
                  type: 'REMOVE_SHEET_ADJUSTMENT',
                  adjustmentId: editor.adjustmentId ?? '',
                  family: 'COMPANION',
                  target: panel.target,
                  expectedVersion
                })
              }
              onCommit={async (commit) => {
                const metadata = getSheetAdjustmentMetadata(editor.adjustmentId, commit)
                switch (editor.field) {
                  case 'SIZE_OVERRIDE': {
                    const value = String(commit.value)
                    if (!isSizeCode(value)) return false
                    return await submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...metadata,
                        family: 'COMPANION',
                        companionInstanceId: panel.companionInstanceId,
                        field: 'SIZE_OVERRIDE',
                        value
                      }
                    })
                  }
                  case 'ALIGNMENT_OVERRIDE':
                  case 'CREATURE_TYPE_OVERRIDE':
                    return await submitCommand({
                      type: 'UPSERT_SHEET_ADJUSTMENT',
                      expectedVersion,
                      adjustment: {
                        ...metadata,
                        family: 'COMPANION',
                        companionInstanceId: panel.companionInstanceId,
                        field: editor.field,
                        value: String(commit.value)
                      }
                    })
                }
              }}
            />
          ))}
        </section>
      ) : null}

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Name and notes</h3>
        {panel.textEditors.map((editor) => (
          <CharacterSheetTextEditor
            editor={editor}
            key={editor.field}
            pending={pending || !canUpdate}
            onCommit={(value) =>
              update(editor.field === 'CUSTOM_NAME' ? { customName: value } : { notes: value })
            }
          />
        ))}
      </section>

      <section className={styles.disclosureSection}>
        <Accordion
          classNames={{
            content: styles.disclosureContent,
            control: styles.disclosureControl,
            item: styles.disclosureItem,
            root: styles.disclosureRoot
          }}
          multiple
        >
          <Accordion.Item value='actions'>
            <Accordion.Control>Actions</Accordion.Control>
            <Accordion.Panel>
              <ExtraReferenceList
                empty='No authored actions are available.'
                items={panel.actions}
              />
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value='features'>
            <Accordion.Control>Features</Accordion.Control>
            <Accordion.Panel>
              <ExtraReferenceList
                empty='No authored features are available.'
                items={panel.features}
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </section>

      <section className={styles.section}>
        <div className={styles.actions}>
          {canRemove ? (
            <Button color='red' disabled={pending} variant='subtle' onClick={() => void remove()}>
              Remove extra
            </Button>
          ) : null}
        </div>
      </section>

      {panel.state !== 'DEFAULT' && canReset ? (
        <section className={styles.section}>
          <div className={styles.actions}>
            <Button
              color='red'
              disabled={pending}
              variant='subtle'
              onClick={() =>
                void submitCommand({
                  type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
                  expectedVersion,
                  target: panel.target
                })
              }
            >
              Reset customizations
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
