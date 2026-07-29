import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, Text, TextInput } from '@mantine/core'
import { IconCheck, IconSearch } from '@tabler/icons-react'
import { renderSanitizedRichHtml } from '#ui/primitives/renderSanitizedRichHtml'
import { compareCharacterBuilderLabels } from './optionProjection'
import * as sharedStyles from '../shared/builderShared.css'
import * as styles from './characterSelection.css'
import type {
  CharacterSelectionCardGroup,
  CharacterSelectionModalProps
} from './CharacterSelectionModal.types'

export function CharacterSelectionModal({
  actionLabel,
  currentId,
  description,
  groups,
  opened,
  selectedId,
  title,
  onClose,
  onCommit,
  onSelectedIdChange
}: CharacterSelectionModalProps) {
  const [query, setQuery] = useState('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (opened) setQuery('')
  }, [opened])

  useEffect(() => {
    if (opened) scrollerRef.current?.scrollTo({ top: 0 })
  }, [opened, query])

  const filteredGroups = useMemo(() => filterSelectionGroups(groups, query), [groups, query])
  const hasOptions = filteredGroups.some((group) => group.options.length > 0)
  return (
    <Modal
      centered
      size='100vw'
      opened={opened}
      onClose={onClose}
      title={title}
      closeButtonProps={{ 'aria-label': `Close ${title}` }}
      classNames={{
        content: styles.selectionModalContent,
        inner: styles.selectionModalInner,
        header: styles.selectionModalHeader,
        body: styles.selectionModalBody,
        title: styles.selectionModalTitle
      }}
    >
      <div className={styles.selectionModalLayout}>
        <div className={styles.selectionModalIntro}>
          <Text className={sharedStyles.mutedText}>{description}</Text>
          <TextInput
            label='Search'
            leftSection={<IconSearch aria-hidden size={16} />}
            placeholder={`Search ${getSelectionSubject(title)}`}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <div
          ref={scrollerRef}
          className={styles.selectionModalScroller}
          role='radiogroup'
          aria-label={title}
        >
          {hasOptions ? (
            filteredGroups.map((group) => (
              <section key={group.id} className={styles.selectionGroup}>
                {group.label ? <h3 className={styles.selectionGroupTitle}>{group.label}</h3> : null}
                <div className={styles.selectionCardGrid}>
                  {group.options.map((option) => {
                    const selected = option.id === selectedId
                    const current = option.id === currentId
                    const inputId = `character-selection-${option.id}`
                    const primaryDetails = option.details.filter(
                      (detail) => detail.prominence === 'primary'
                    )
                    const secondaryDetails = option.details.filter(
                      (detail) => detail.prominence !== 'primary'
                    )
                    return (
                      <div
                        key={option.id}
                        className={`${styles.selectionCard} ${selected ? styles.selectionCardSelected : ''}`}
                      >
                        <input
                          id={inputId}
                          className={styles.selectionCardRadio}
                          type='radio'
                          name='character-selection'
                          value={option.id}
                          checked={selected}
                          disabled={option.disabled}
                          onChange={() => onSelectedIdChange(option.id)}
                        />
                        <span className={styles.selectionCardHeader}>
                          <span className={styles.selectionCardTitleGroup}>
                            <span className={styles.selectionCardIndicator} aria-hidden>
                              {selected ? <IconCheck size={13} stroke={3} /> : null}
                            </span>
                            <label htmlFor={inputId} className={styles.selectionCardTitle}>
                              <Text component='span' className={styles.selectionCardTitleText}>
                                {option.label}
                              </Text>
                            </label>
                          </span>
                          {selected ? (
                            <Button
                              type='button'
                              size='compact-sm'
                              disabled={option.disabled}
                              onClick={() => onCommit(option.id)}
                            >
                              {actionLabel}
                            </Button>
                          ) : current ? (
                            <Text component='span' c='blue' fw={700} size='sm'>
                              Current
                            </Text>
                          ) : null}
                        </span>
                        <label htmlFor={inputId} className={styles.selectionCardBody}>
                          {option.description?.trim() ? (
                            <span className={styles.selectionCardDescription}>
                              {renderSanitizedRichHtml(option.description)}
                            </span>
                          ) : null}
                          {primaryDetails.length > 0 ? (
                            <dl className={styles.selectionCardPrimaryDetails}>
                              {primaryDetails.map((detail) => (
                                <div
                                  key={detail.label}
                                  className={styles.selectionCardPrimaryDetail}
                                >
                                  <dt className={styles.selectionCardDetailLabel}>
                                    {detail.label}
                                  </dt>
                                  <dd className={styles.selectionCardPrimaryValue}>
                                    {detail.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          {secondaryDetails.length > 0 ? (
                            <dl className={styles.selectionCardDetails}>
                              {secondaryDetails.map((detail) => (
                                <div
                                  key={detail.label}
                                  className={`${styles.selectionCardDetail} ${detail.status === 'unmet' ? styles.selectionCardDetailUnmet : ''}`}
                                >
                                  <dt className={styles.selectionCardDetailLabel}>
                                    {detail.label}
                                  </dt>
                                  <dd className={styles.selectionCardDetailValue}>
                                    {detail.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          {option.disabledReason ? (
                            <Text component='span' c='red' size='sm'>
                              {option.disabledReason}
                            </Text>
                          ) : null}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className={styles.selectionEmptyState}>
              <Text fw={700}>No matches</Text>
              <Text className={sharedStyles.mutedText} size='sm'>
                Try a different name or detail.
              </Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function getSelectionSubject(title: string): string {
  return title
    .replace(/^Choose an? /i, '')
    .replace(/^Change /i, '')
    .toLocaleLowerCase('en')
}

function filterSelectionGroups(
  groups: CharacterSelectionCardGroup[],
  query: string
): CharacterSelectionCardGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en')

  return groups
    .map((group) => ({
      ...group,
      options: group.options
        .filter((option) => {
          if (!normalizedQuery) return true
          return [
            option.label,
            option.description ?? '',
            option.disabledReason ?? '',
            ...option.details.flatMap((detail) => [
              detail.label,
              typeof detail.value === 'string'
                ? detail.value
                : typeof detail.value === 'number'
                  ? detail.value.toString()
                  : ''
            ])
          ].some((value) => value.toLocaleLowerCase('en').includes(normalizedQuery))
        })
        .sort((left, right) => compareCharacterBuilderLabels(left.label, right.label))
    }))
    .filter((group) => group.options.length > 0)
}
