import type { CharacterSheetActionsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { useState } from 'react'
import { Text } from '@mantine/core'
import { CharacterSheetDetailPanel } from '../shared/CharacterSheetDetailPanel'
import { CharacterSheetResourceStepper } from '../shared/CharacterSheetResourceStepper'
import * as actionSummaryStyles from './actionSummary.css'
import * as actionTableStyles from './actionTable.css'
import * as panelStyles from '../shared/panel.css'
import * as rowStyles from '../shared/rows.css'
import {
  CHARACTER_SHEET_ACTION_FILTERS,
  formatActionUnavailableReason,
  formatPlayableActionSummary,
  getPlayableActions,
  listActiveBonuses,
  type CharacterSheetActionFilter,
  type CharacterSheetPlayableAction
} from './characterSheetActions.utils'
import type { OpenSheetPanel, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetRollText } from '../dice/CharacterSheetRollValue'
import { CharacterSheetSpellSlotExchange } from './CharacterSheetSpellSlotExchange'
import { CharacterSheetActiveBonuses } from './CharacterSheetActiveBonuses'
import { getMechanicRollTargets } from '../dice/dice.utils'

export function CharacterSheetActions({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: {
  hideTitle?: boolean
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: CharacterSheetActionsDto
  submitCommand: SubmitSheetCommand
}) {
  const version = sheet.meta.streamVersion
  const actions = getPlayableActions(sheet)
  const [activeFilter, setActiveFilter] = useState<CharacterSheetActionFilter>('ALL')
  const [failedResourceId, setFailedResourceId] = useState<string>()
  const availableFilters = CHARACTER_SHEET_ACTION_FILTERS.filter(
    (filter) =>
      filter.id === 'ALL' ||
      (filter.id === 'LIMITED_USE'
        ? actions.some((action) => action.resource)
        : actions.some((action) => action.kind === filter.id && !action.limitedUseOnly))
  )
  const visibleGroups = CHARACTER_SHEET_ACTION_FILTERS.filter(
    (filter) => filter.id !== 'ALL' && filter.id !== 'LIMITED_USE'
  )
    .filter(
      (filter) =>
        activeFilter === 'ALL' || activeFilter === 'LIMITED_USE' || filter.id === activeFilter
    )
    .map((filter) => ({
      ...filter,
      actions: actions.filter(
        (action) =>
          action.kind === filter.id &&
          (activeFilter === 'LIMITED_USE' ? Boolean(action.resource) : !action.limitedUseOnly)
      )
    }))
    .filter((group) => group.actions.length > 0)

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-actions'
      hideTitle={hideTitle}
      title='Actions'
    >
      <div
        className={actionSummaryStyles.actionFilterBar}
        aria-label='Action type filters'
        role='toolbar'
      >
        {availableFilters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter.id}
            className={actionSummaryStyles.actionFilterChip}
            data-active={activeFilter === filter.id}
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            type='button'
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className={actionSummaryStyles.actionCompactList}>
        {visibleGroups.length ? (
          visibleGroups.map((group) => (
            <section className={actionSummaryStyles.actionGroup} key={group.id}>
              <Text className={actionSummaryStyles.actionGroupTitle} component='h2'>
                {group.label}
              </Text>
              {group.id === 'ATTACK' && activeFilter !== 'LIMITED_USE' ? (
                <div
                  aria-hidden='true'
                  className={`${actionSummaryStyles.actionDataHeader} ${actionSummaryStyles.actionAttackColumns}`}
                >
                  <span>Name</span>
                  <span>Range</span>
                  <span>Hit / DC</span>
                  <span>Damage</span>
                </div>
              ) : null}
              <div className={actionSummaryStyles.actionGroupRows}>
                {group.actions.map((action) => {
                  const resource = action.resource
                  const target = action.target
                  const isTabularAttack = action.kind === 'ATTACK' && activeFilter !== 'LIMITED_USE'
                  const effect =
                    action.kind === 'ATTACK' && !isTabularAttack
                      ? (action.description ?? action.playFacts?.effect ?? undefined)
                      : (formatPlayableActionSummary(action) ??
                        action.playFacts?.effect ??
                        undefined)
                  const rollTargets = getMechanicRollTargets(action.mechanics, action.label)
                  const unavailableReason =
                    action.availability.status === 'UNAVAILABLE'
                      ? formatActionUnavailableReason(action.availability.reasonCode)
                      : undefined
                  const spellSlotExchange = action.mechanics
                    ?.flatMap((mechanic) => mechanic.outcomes)
                    .flatMap((outcome) =>
                      outcome.kind === 'EFFECT' && outcome.spellSlotExchange
                        ? [outcome.spellSlotExchange]
                        : []
                    )[0]

                  if (!isTabularAttack)
                    return (
                      <div
                        aria-label={action.label}
                        className={actionSummaryStyles.actionDescriptionRow}
                        key={action.id}
                        role='group'
                      >
                        <div className={actionSummaryStyles.actionDescriptionHeading}>
                          <div className={actionSummaryStyles.actionDescriptionIdentity}>
                            {target ? (
                              <button
                                className={actionTableStyles.actionIdentityButton}
                                type='button'
                                onClick={() => openPanel?.(target)}
                              >
                                {action.label}
                              </button>
                            ) : (
                              <Text className={actionTableStyles.playRowTitle} component='span'>
                                {action.label}
                              </Text>
                            )}
                            {action.kind === 'OTHER' ? (
                              <Text
                                className={actionSummaryStyles.actionSpecialLabel}
                                component='span'
                              >
                                (Special)
                              </Text>
                            ) : null}
                            <CharacterSheetActiveBonuses
                              bonuses={listActiveBonuses(action.mechanics)}
                            />
                          </div>
                          {resource ? (
                            <div
                              aria-label={`Uses ${resource.remaining} of ${resource.max} remaining`}
                              className={actionSummaryStyles.actionDescriptionUses}
                            >
                              <ActionResourceStepper
                                actionId={action.id}
                                actionLabel={action.label}
                                available={!unavailableReason}
                                pending={pending}
                                resource={resource}
                                setFailedResourceId={setFailedResourceId}
                                submitCommand={submitCommand}
                                version={version}
                              />
                            </div>
                          ) : null}
                        </div>
                        {effect ? (
                          <Text className={actionSummaryStyles.actionDescriptionText}>
                            <CharacterSheetRollText targets={rollTargets} text={effect} />
                          </Text>
                        ) : null}
                        {spellSlotExchange ? (
                          <CharacterSheetSpellSlotExchange
                            actionId={action.id}
                            actionLabel={action.label}
                            available={!unavailableReason}
                            exchange={spellSlotExchange}
                            pending={pending}
                            sheet={sheet}
                            submitCommand={submitCommand}
                          />
                        ) : null}
                        {unavailableReason ? (
                          <Text className={panelStyles.muted}>{unavailableReason}</Text>
                        ) : null}
                        {resource && failedResourceId === resource.id ? (
                          <Text className={rowStyles.commandInlineError} role='alert'>
                            Charges could not be updated. The sheet was refreshed; try again.
                          </Text>
                        ) : null}
                      </div>
                    )

                  return (
                    <div
                      aria-label={action.label}
                      className={`${actionSummaryStyles.actionDataRow} ${actionSummaryStyles.actionAttackColumns}`}
                      key={action.id}
                      role='group'
                    >
                      <div className={actionTableStyles.actionRowIdentity}>
                        <div className={actionTableStyles.actionRowName}>
                          {target ? (
                            <button
                              className={actionTableStyles.actionIdentityButton}
                              type='button'
                              onClick={() => openPanel?.(target)}
                            >
                              {action.label}
                            </button>
                          ) : (
                            <Text className={actionTableStyles.playRowTitle} component='span'>
                              {action.label}
                            </Text>
                          )}
                          <CharacterSheetActiveBonuses
                            bonuses={listActiveBonuses(action.mechanics)}
                          />
                        </div>
                        {action.sourceLabel || resource || unavailableReason ? (
                          <Text className={actionTableStyles.actionCompactSource} component='span'>
                            {[
                              action.sourceLabel,
                              resource ? `${resource.remaining} / ${resource.max} uses` : undefined,
                              unavailableReason
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                      </div>
                      <div
                        aria-label={`Range ${action.playFacts?.range ?? 'not applicable'}`}
                        className={actionTableStyles.actionDataCell}
                      >
                        <strong>{action.playFacts?.range ?? '—'}</strong>
                      </div>
                      <div
                        aria-label={`Hit or DC ${action.playFacts?.hitOrDc ?? 'not applicable'}`}
                        className={actionTableStyles.actionDataCell}
                      >
                        <strong>
                          <CharacterSheetRollText
                            targets={rollTargets.filter(
                              (target) => target.source.kind === 'ATTACK'
                            )}
                            text={action.playFacts?.hitOrDc ?? '—'}
                          />
                        </strong>
                      </div>
                      <div
                        aria-label={`Damage ${action.playFacts?.effect ?? 'not applicable'}`}
                        className={actionTableStyles.actionDataCell}
                      >
                        <strong>
                          <CharacterSheetRollText
                            targets={rollTargets.filter(
                              (target) =>
                                target.source.kind === 'DAMAGE' || target.source.kind === 'HEALING'
                            )}
                            text={action.playFacts?.effect ?? '—'}
                          />
                        </strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        ) : (
          <Text className={panelStyles.muted}>No matching actions are currently available.</Text>
        )}
      </div>
    </CharacterSheetDetailPanel>
  )
}

function ActionResourceStepper({
  actionId,
  actionLabel,
  available,
  pending,
  resource,
  setFailedResourceId,
  submitCommand,
  version
}: {
  actionId: string
  actionLabel: string
  available: boolean
  pending: boolean
  resource: NonNullable<CharacterSheetPlayableAction['resource']>
  setFailedResourceId: (resourceId: string | undefined) => void
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const updateResource = async (type: 'USE_RESOURCE' | 'RESTORE_RESOURCE') => {
    setFailedResourceId(undefined)
    const succeeded = await submitCommand({
      type,
      resourceGrantId: resource.id,
      ...(type === 'USE_RESOURCE' ? { actionId } : {}),
      ...(type === 'USE_RESOURCE' && resource.cost > 1 ? { amount: resource.cost } : {}),
      expectedVersion: version
    })
    if (!succeeded) setFailedResourceId(resource.id)
  }

  return (
    <CharacterSheetResourceStepper
      decreaseDisabled={pending || !available || resource.remaining < resource.cost}
      decreaseLabel={`Use ${resource.cost === 1 ? 'one' : resource.cost} ${actionLabel} charge${resource.cost === 1 ? '' : 's'}`}
      increaseDisabled={pending || resource.used <= 0}
      increaseLabel={`Restore one ${actionLabel} charge`}
      label={`${actionLabel} charges`}
      maximum={resource.max}
      remaining={resource.remaining}
      onDecrease={() => void updateResource('USE_RESOURCE')}
      onIncrease={() => void updateResource('RESTORE_RESOURCE')}
    />
  )
}
