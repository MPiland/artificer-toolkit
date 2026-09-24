import type { CSSProperties, RefObject } from 'react'
import { richHtmlToPlainText } from '#lib/richText'
import { AuthoredListActions } from './AuthoredListActions'
import {
  AuthoredListAccentDot,
  AuthoredListBadges,
  AuthoredListStatusChip
} from './AuthoredListItemMeta'
import type {
  AuthoredListActionHandlers,
  AuthoredListAttributeColumn,
  AuthoredListAttributeValue,
  AuthoredListItem
} from './AuthoredList.types'
import { getAuthoredListSourceLabel } from './authoredList.utils'
import * as itemMetaStyles from './AuthoredListItemMeta.css'
import * as styles from './AuthoredListCards.css'

export function AuthoredListCards({
  cardColumnCount,
  filteredItems,
  attributeColumns,
  renderedRows,
  paddingTop,
  paddingBottom,
  viewportRef,
  embedded = false,
  onView,
  onViewIntent,
  actionHandlers,
  useMenuActions
}: {
  cardColumnCount: number
  filteredItems: AuthoredListItem[]
  attributeColumns: AuthoredListAttributeColumn[]
  renderedRows: number[]
  paddingTop: number
  paddingBottom: number
  viewportRef?: RefObject<HTMLDivElement | null>
  embedded?: boolean
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  return (
    <div className={embedded ? undefined : styles.cardViewport} ref={viewportRef}>
      {paddingTop > 0 ? <div aria-hidden='true' style={{ height: paddingTop }} /> : null}
      <div className={styles.cardStack}>
        {renderedRows.map((rowIndex) => {
          const rowItems = filteredItems.slice(
            rowIndex * cardColumnCount,
            rowIndex * cardColumnCount + cardColumnCount
          )

          return (
            <div
              className={styles.cardRow}
              data-testid='authored-list-card-row'
              key={rowIndex}
              style={{ '--authored-list-card-columns': cardColumnCount } as CSSProperties}
            >
              {rowItems.map((item) => (
                <AuthoredListCard
                  item={item}
                  attributeColumns={attributeColumns}
                  key={item.id}
                  onView={onView}
                  onViewIntent={onViewIntent}
                  actionHandlers={actionHandlers}
                  useMenuActions={useMenuActions}
                />
              ))}
            </div>
          )
        })}
      </div>
      {paddingBottom > 0 ? <div aria-hidden='true' style={{ height: paddingBottom }} /> : null}
    </div>
  )
}

function AuthoredListCard({
  item,
  attributeColumns,
  onView,
  onViewIntent,
  actionHandlers,
  useMenuActions
}: {
  item: AuthoredListItem
  attributeColumns: AuthoredListAttributeColumn[]
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  actionHandlers: AuthoredListActionHandlers
  useMenuActions: boolean
}) {
  const sourceLabel = getAuthoredListSourceLabel(item)
  const hierarchySubline = item.hierarchy?.parentLabel
    ? `Under ${item.hierarchy.parentLabel}`
    : undefined
  const primaryAttribute = attributeColumns[0]
  const secondaryAttribute = attributeColumns[1]
  const primaryLabel = primaryAttribute
    ? formatAttributeValue(
        item.attributes?.[primaryAttribute.key],
        primaryAttribute.fallback ?? primaryAttribute.label
      )
    : (item.description ?? 'Details not set')
  const secondaryLabel = secondaryAttribute
    ? formatAttributeValue(
        item.attributes?.[secondaryAttribute.key],
        secondaryAttribute.fallback ?? secondaryAttribute.label
      )
    : (item.description ?? 'Summary not set')
  const primaryAttributeInHeader = primaryAttribute?.key === 'level'
  const sourceChipClass =
    item.sourceKind === 'master' ? itemMetaStyles.masterSourceChip : itemMetaStyles.sourceChip
  const description = richHtmlToPlainText(item.description ?? '') || 'No description yet.'
  const handleView = () => {
    if (item.permissions.canView) {
      onView?.(item)
    }
  }

  return (
    <article
      aria-label={`View ${item.name}`}
      className={styles.card}
      onClick={handleView}
      onPointerEnter={() => {
        if (item.permissions.canView) {
          onViewIntent?.(item)
        }
      }}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleGroup}>
          <AuthoredListAccentDot className={styles.cardSourceDot} item={item} />
          <div className={styles.cardTitleStack}>
            <h2 className={styles.cardTitle}>
              {item.permissions.canView ? (
                <button
                  aria-label={`Open ${item.name}`}
                  className={styles.cardTitleButton}
                  onFocus={() => onViewIntent?.(item)}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleView()
                  }}
                  type='button'
                >
                  {item.name}
                </button>
              ) : (
                item.name
              )}
            </h2>
            {hierarchySubline || secondaryAttribute ? (
              <span className={styles.cardSubline}>{hierarchySubline ?? secondaryLabel}</span>
            ) : null}
          </div>
        </div>
        <span className={styles.cardMetaGroup}>
          <AuthoredListStatusChip item={item} />
          {primaryAttributeInHeader ? (
            <span className={styles.levelBadge}>{primaryLabel}</span>
          ) : null}
        </span>
      </div>
      <div className={styles.cardFeatureRow}>
        {primaryAttribute && !primaryAttributeInHeader ? (
          <span className={styles.levelBadge}>{primaryLabel}</span>
        ) : null}
        <span className={styles.cardFeatureText}>{description}</span>
      </div>
      <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
        <span className={styles.cardFooterMeta}>
          <span className={sourceChipClass}>{sourceLabel}</span>
          <AuthoredListBadges item={item} />
        </span>
        <AuthoredListActions
          item={item}
          actionHandlers={actionHandlers}
          itemName={item.name}
          menu={useMenuActions}
        />
      </div>
    </article>
  )
}

function formatAttributeValue(value: AuthoredListAttributeValue, fallback: string) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : fallback
  return value ?? fallback
}
