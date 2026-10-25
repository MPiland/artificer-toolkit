import { Accordion, Button, Modal, Switch, Text } from '@mantine/core'
import { useState } from 'react'

import { AuthoredDetailProse, formatEnumLabel } from '#app/components/AuthoredDetail'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetFeatureUseControl } from '../shared/CharacterSheetFeatureUseControl'
import { CharacterSheetResourceStepper } from '../shared/CharacterSheetResourceStepper'
import * as featureUseStyles from '../shared/featureUse.css'
import { CharacterSheetAdjustmentEditor } from './CharacterSheetAdjustmentEditor'
import { getSheetAdjustmentMetadata, getSheetEditorKey } from './inspector.model'
import { CharacterSheetTextEditor } from './CharacterSheetTextEditor'
import * as inspectorEditorStyles from './inspectorEditor.css'
import * as inspectorShellStyles from './inspectorShell.css'

type ItemPanel = Extract<CharacterSheetPanelDto, { kind: 'ITEM' }>

export function CharacterSheetItemPanelContent({
  expectedVersion,
  panel,
  pending,
  submitCommand,
  onClose
}: {
  expectedVersion: number
  panel: ItemPanel
  pending: boolean
  submitCommand: SubmitSheetCommand
  onClose: () => void
}) {
  const [removeOpen, setRemoveOpen] = useState(false)
  const quantity = Number(panel.facts.find((fact) => fact.label === 'Quantity')?.value ?? 0)
  const canAdjust =
    panel.editable &&
    panel.allowedCommands.includes('UPSERT_ADJUSTMENT') &&
    panel.allowedCommands.includes('REMOVE_ADJUSTMENT')
  const canUpdate = panel.editable && panel.allowedCommands.includes('UPDATE_OWNED_ITEM')
  const canRemove = panel.editable && panel.allowedCommands.includes('REMOVE_OWNED_ITEM')
  const canSetEquipped = panel.editable && panel.allowedCommands.includes('SET_ITEM_EQUIPPED')
  const canSetAttuned = panel.editable && panel.allowedCommands.includes('SET_ITEM_ATTUNED')
  const canUseResource = panel.editable && panel.allowedCommands.includes('USE_RESOURCE')
  const canRecoverResource = panel.editable && panel.allowedCommands.includes('RECOVER_RESOURCE')
  const canReset = panel.editable && panel.allowedCommands.includes('RESET_ADJUSTMENTS')

  return (
    <div className={inspectorShellStyles.inspector}>
      <section className={inspectorShellStyles.section}>
        <div className={inspectorShellStyles.summary}>
          <div>
            <Text className={inspectorShellStyles.summaryLabel}>Owned item</Text>
            <Text className={inspectorShellStyles.summaryValue}>{panel.displayName}</Text>
          </div>
        </div>
        {panel.authoredName !== panel.displayName ? (
          <Text className={inspectorShellStyles.muted}>{panel.authoredName}</Text>
        ) : null}
      </section>

      <section className={inspectorShellStyles.section}>
        <h3 className={inspectorShellStyles.sectionTitle}>Info</h3>
        <div className={inspectorEditorStyles.entries}>
          {panel.facts.map((fact) => (
            <div className={inspectorEditorStyles.entry} key={fact.label}>
              <Text className={inspectorShellStyles.muted}>{fact.label}</Text>
              <Text fw={700}>{fact.value}</Text>
            </div>
          ))}
        </div>
      </section>

      {panel.resources.length ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Limited uses</h3>
          <div className={inspectorEditorStyles.entries}>
            {panel.resources.map((resource) => (
              <div className={inspectorEditorStyles.entry} key={resource.id}>
                <div>
                  <Text fw={700}>{resource.label}</Text>
                  {resource.recoveries.length ? (
                    <Text className={inspectorShellStyles.muted}>
                      Resets:{' '}
                      {resource.recoveries
                        .map(({ trigger }) => formatEnumLabel(trigger))
                        .join(', ')}
                    </Text>
                  ) : null}
                </div>
                <CharacterSheetResourceStepper
                  decreaseDisabled={pending || !canUseResource}
                  decreaseLabel={`Use one ${resource.label}`}
                  increaseDisabled={pending || !canRecoverResource}
                  increaseLabel={`Restore one ${resource.label}`}
                  label={resource.label}
                  maximum={resource.maximum}
                  remaining={resource.remaining}
                  onDecrease={() =>
                    void submitCommand({
                      type: 'USE_RESOURCE',
                      expectedVersion,
                      resourceGrantId: resource.id
                    })
                  }
                  onIncrease={() =>
                    void submitCommand({
                      type: 'RESTORE_RESOURCE',
                      expectedVersion,
                      resourceGrantId: resource.id
                    })
                  }
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {panel.features.length ? (
        <section className={inspectorShellStyles.section}>
          <h3 className={inspectorShellStyles.sectionTitle}>Features</h3>
          <div className={inspectorShellStyles.featureList}>
            {panel.features.map((feature) => {
              const resource = feature.resourceGrantId
                ? panel.resources.find((candidate) => candidate.id === feature.resourceGrantId)
                : undefined
              const resourceCost = feature.resourceCost ?? 1

              return (
                <article className={inspectorShellStyles.featureEntry} key={feature.id}>
                  <div className={featureUseStyles.heading}>
                    <Text fw={700}>{feature.label}</Text>
                    {resource ? (
                      <CharacterSheetFeatureUseControl
                        cost={resourceCost}
                        disabled={pending || !canUseResource || resource.remaining < resourceCost}
                        label={feature.label}
                        maximum={resource.maximum}
                        remaining={resource.remaining}
                        onUse={() =>
                          void submitCommand({
                            type: 'USE_RESOURCE',
                            expectedVersion,
                            resourceGrantId: resource.id,
                            ...(resourceCost > 1 ? { amount: resourceCost } : {})
                          })
                        }
                      />
                    ) : null}
                  </div>
                  {feature.description ? (
                    <div className={inspectorShellStyles.featureDescription}>
                      <AuthoredDetailProse html={feature.description} fallback='' />
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {panel.description || canUpdate || canAdjust ? (
        <section className={inspectorShellStyles.disclosureSection}>
          <Accordion
            multiple
            classNames={{
              content: inspectorShellStyles.disclosureContent,
              control: inspectorShellStyles.disclosureControl,
              root: inspectorShellStyles.disclosureRoot
            }}
            order={3}
            variant='default'
          >
            {panel.description ? (
              <Accordion.Item className={inspectorShellStyles.disclosureItem} value='description'>
                <Accordion.Control>
                  <Text fw={700}>Description</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <AuthoredDetailProse html={panel.description} fallback='' />
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
            {canUpdate || canAdjust ? (
              <Accordion.Item className={inspectorShellStyles.disclosureItem} value='customize'>
                <Accordion.Control>
                  <Text fw={700}>Customize</Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <div className={inspectorShellStyles.disclosureBody}>
                    {canSetEquipped ? (
                      <Switch
                        checked={panel.equippedSlot !== null}
                        disabled={pending}
                        label='Equipped'
                        onChange={(event) =>
                          void submitCommand({
                            type: event.currentTarget.checked ? 'EQUIP_ITEM' : 'UNEQUIP_ITEM',
                            expectedVersion,
                            itemId: panel.itemInstanceId
                          })
                        }
                      />
                    ) : null}
                    {canSetEquipped &&
                    (panel.equippedSlot === 'MAIN_HAND' || panel.equippedSlot === 'OFF_HAND') ? (
                      <Button
                        disabled={pending}
                        size='xs'
                        variant='default'
                        onClick={() =>
                          void submitCommand({ type: 'SWAP_HELD_ITEMS', expectedVersion })
                        }
                      >
                        Swap hands
                      </Button>
                    ) : null}
                    {panel.requiresAttunement && canSetAttuned ? (
                      <Switch
                        checked={panel.attuned}
                        disabled={pending}
                        label='Attuned'
                        onChange={(event) =>
                          void submitCommand({
                            type: event.currentTarget.checked ? 'ATTUNE_ITEM' : 'UNATTUNE_ITEM',
                            expectedVersion,
                            itemId: panel.itemInstanceId
                          })
                        }
                      />
                    ) : null}
                    {canUpdate ? (
                      <div className={inspectorEditorStyles.entry}>
                        <Text className={inspectorShellStyles.muted}>Quantity</Text>
                        <div className={inspectorEditorStyles.actions}>
                          <Button
                            disabled={pending || (quantity <= 1 && !canRemove)}
                            size='xs'
                            variant='default'
                            onClick={() => {
                              if (quantity <= 1) {
                                setRemoveOpen(true)
                                return
                              }
                              void submitCommand({
                                type: 'UPDATE_INVENTORY_ITEM',
                                expectedVersion,
                                itemId: panel.itemInstanceId,
                                quantity: quantity - 1
                              })
                            }}
                          >
                            −
                          </Button>
                          <Text fw={700}>{quantity}</Text>
                          <Button
                            disabled={pending}
                            size='xs'
                            variant='default'
                            onClick={() => {
                              void submitCommand({
                                type: 'UPDATE_INVENTORY_ITEM',
                                expectedVersion,
                                itemId: panel.itemInstanceId,
                                quantity: quantity + 1
                              })
                            }}
                          >
                            +
                          </Button>
                          {canRemove ? (
                            <Button
                              color='red'
                              disabled={pending}
                              size='xs'
                              variant='subtle'
                              onClick={() => setRemoveOpen(true)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {canUpdate
                      ? panel.textEditors.map((editor) => (
                          <CharacterSheetTextEditor
                            editor={editor}
                            key={`${panel.itemInstanceId}:${editor.field}`}
                            pending={pending}
                            onCommit={async (value) =>
                              await submitCommand({
                                type: 'UPDATE_INVENTORY_ITEM',
                                expectedVersion,
                                itemId: panel.itemInstanceId,
                                ...(editor.field === 'CUSTOM_NAME'
                                  ? { customName: value }
                                  : { notes: value })
                              })
                            }
                          />
                        ))
                      : null}
                    {canAdjust
                      ? panel.numericEditors.map((editor) => (
                          <CharacterSheetAdjustmentEditor
                            editor={editor}
                            key={getSheetEditorKey(editor)}
                            pending={pending}
                            onClear={async () =>
                              await submitCommand({
                                type: 'REMOVE_SHEET_ADJUSTMENT',
                                adjustmentId: editor.adjustmentId ?? '',
                                family: 'ITEM',
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
                                  family: 'ITEM',
                                  itemInstanceId: panel.itemInstanceId,
                                  field: editor.field,
                                  value: Number(commit.value)
                                }
                              })
                            }
                          />
                        ))
                      : null}
                    {canAdjust
                      ? panel.propertyEditors.map((editor) => (
                          <Switch
                            checked={editor.value}
                            disabled={pending}
                            key={editor.field}
                            label={editor.label}
                            onChange={(event) => {
                              if (!event.currentTarget.checked) {
                                if (!editor.adjustmentId) return
                                void submitCommand({
                                  type: 'REMOVE_SHEET_ADJUSTMENT',
                                  adjustmentId: editor.adjustmentId,
                                  family: 'ITEM',
                                  target: panel.target,
                                  expectedVersion
                                })
                                return
                              }
                              void submitCommand({
                                type: 'UPSERT_SHEET_ADJUSTMENT',
                                expectedVersion,
                                adjustment: {
                                  family: 'ITEM',
                                  itemInstanceId: panel.itemInstanceId,
                                  field: editor.field,
                                  value: true
                                }
                              })
                            }}
                          />
                        ))
                      : null}
                  </div>
                </Accordion.Panel>
              </Accordion.Item>
            ) : null}
          </Accordion>
        </section>
      ) : null}

      {panel.state !== 'DEFAULT' && canReset ? (
        <section className={inspectorShellStyles.section}>
          <div className={inspectorEditorStyles.actions}>
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

      <Modal
        opened={removeOpen}
        title={`Remove ${panel.displayName}?`}
        onClose={() => setRemoveOpen(false)}
      >
        <div className={inspectorShellStyles.disclosureBody}>
          <Text>This removes the item and its Sheet customizations.</Text>
          <div className={inspectorEditorStyles.actions}>
            <Button variant='default' onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button
              color='red'
              disabled={pending}
              onClick={async () => {
                const removed = await submitCommand({
                  type: 'REMOVE_INVENTORY_ITEM',
                  expectedVersion,
                  itemId: panel.itemInstanceId
                })
                if (removed) {
                  setRemoveOpen(false)
                  onClose()
                }
              }}
            >
              Remove item
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
