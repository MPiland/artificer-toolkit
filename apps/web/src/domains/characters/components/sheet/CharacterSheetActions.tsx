import { useState } from 'react'
import { Button, Text } from '@mantine/core'
import { CharacterSheetDetailPanel } from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import {
  CHARACTER_SHEET_ACTION_FILTERS,
  formatPlayableActionSummary,
  getPlayableActions,
  type CharacterSheetActionFilter,
  type CharacterSheetPlayableAction
} from './characterSheetActions.utils'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetActions({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps & { hideTitle?: boolean }) {
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
      <div className={styles.actionFilterBar} aria-label='Action type filters' role='toolbar'>
        {availableFilters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter.id}
            className={styles.actionFilterChip}
            data-active={activeFilter === filter.id}
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            type='button'
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className={styles.actionCompactList}>
        {visibleGroups.length ? (
          visibleGroups.map((group) => (
            <section className={styles.actionGroup} key={group.id}>
              <Text className={styles.actionGroupTitle} component='h3'>
                {group.label}
              </Text>
              {group.id === 'ATTACK' && activeFilter !== 'LIMITED_USE' ? (
                <div
                  aria-hidden='true'
                  className={`${styles.actionDataHeader} ${styles.actionAttackColumns}`}
                >
                  <span>Name</span>
                  <span>Range</span>
                  <span>Hit / DC</span>
                  <span>Damage</span>
                </div>
              ) : null}
              <div className={styles.actionGroupRows}>
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

                  if (!isTabularAttack)
                    return (
                      <div
                        aria-label={action.label}
                        className={styles.actionDescriptionRow}
                        key={action.id}
                        role='group'
                      >
                        <div className={styles.actionDescriptionHeading}>
                          <div className={styles.actionDescriptionIdentity}>
                            {target ? (
                              <button
                                className={styles.actionIdentityButton}
                                type='button'
                                onClick={() => openPanel?.(target)}
                              >
                                {action.label}
                              </button>
                            ) : (
                              <Text className={styles.playRowTitle} component='span'>
                                {action.label}
                              </Text>
                            )}
                            {action.kind === 'OTHER' ? (
                              <Text className={styles.actionSpecialLabel} component='span'>
                                (Special)
                              </Text>
                            ) : null}
                          </div>
                          {resource ? (
                            <div
                              aria-label={`Uses ${resource.remaining} of ${resource.max} remaining`}
                              className={styles.actionDescriptionUses}
                            >
                              <ActionResourceStepper
                                actionLabel={action.label}
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
                          <Text className={styles.actionDescriptionText}>{effect}</Text>
                        ) : null}
                        {resource && failedResourceId === resource.id ? (
                          <Text className={styles.commandInlineError} role='alert'>
                            Charges could not be updated. The sheet was refreshed; try again.
                          </Text>
                        ) : null}
                      </div>
                    )

                  return (
                    <div
                      aria-label={action.label}
                      className={`${styles.actionDataRow} ${styles.actionAttackColumns}`}
                      key={action.id}
                      role='group'
                    >
                      <div className={styles.actionRowIdentity}>
                        {target ? (
                          <button
                            className={styles.actionIdentityButton}
                            type='button'
                            onClick={() => openPanel?.(target)}
                          >
                            {action.label}
                          </button>
                        ) : (
                          <Text className={styles.playRowTitle} component='span'>
                            {action.label}
                          </Text>
                        )}
                        {action.sourceLabel || resource ? (
                          <Text className={styles.actionCompactSource} component='span'>
                            {[
                              action.sourceLabel,
                              resource ? `${resource.remaining} / ${resource.max} uses` : undefined
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                      </div>
                      <div
                        aria-label={`Range ${action.playFacts?.range ?? 'not applicable'}`}
                        className={styles.actionDataCell}
                      >
                        <strong>{action.playFacts?.range ?? '—'}</strong>
                      </div>
                      <div
                        aria-label={`Hit or DC ${action.playFacts?.hitOrDc ?? 'not applicable'}`}
                        className={styles.actionDataCell}
                      >
                        <strong>{action.playFacts?.hitOrDc ?? '—'}</strong>
                      </div>
                      <div
                        aria-label={`Damage ${action.playFacts?.effect ?? 'not applicable'}`}
                        className={styles.actionDataCell}
                      >
                        <strong>{action.playFacts?.effect ?? '—'}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))
        ) : (
          <Text className={styles.muted}>No matching actions are currently available.</Text>
        )}
      </div>
    </CharacterSheetDetailPanel>
  )
}

function ActionResourceStepper({
  actionLabel,
  pending,
  resource,
  setFailedResourceId,
  submitCommand,
  version
}: {
  actionLabel: string
  pending: boolean
  resource: NonNullable<CharacterSheetPlayableAction['resource']>
  setFailedResourceId: (resourceId: string | undefined) => void
  submitCommand: CharacterSheetSectionProps['submitCommand']
  version: number
}) {
  const updateResource = async (type: 'USE_RESOURCE' | 'RESTORE_RESOURCE') => {
    setFailedResourceId(undefined)
    const succeeded = await submitCommand({
      type,
      resourceGrantId: resource.id,
      expectedVersion: version
    })
    if (!succeeded) setFailedResourceId(resource.id)
  }

  return (
    <div aria-label={`${actionLabel} charges`} className={styles.resourceStepper} role='group'>
      <Button
        aria-label={`Use one ${actionLabel} charge`}
        className={styles.resourceStepButton}
        disabled={pending || resource.remaining <= 0}
        size='compact-xs'
        variant='default'
        onClick={() => void updateResource('USE_RESOURCE')}
      >
        −
      </Button>
      <Text aria-live='polite' className={styles.resourceStepValue} component='output'>
        {resource.remaining} / {resource.max}
      </Text>
      <Button
        aria-label={`Restore one ${actionLabel} charge`}
        className={styles.resourceStepButton}
        disabled={pending || resource.used <= 0}
        size='compact-xs'
        variant='default'
        onClick={() => void updateResource('RESTORE_RESOURCE')}
      >
        +
      </Button>
    </div>
  )
}
