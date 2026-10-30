import { Group, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import {
  Box,
  CircleHelp,
  Copy,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sword,
  Trash2
} from 'lucide-react'
import { withForm } from '../app-form/AppForm'
import { useAuthoringNavigation } from '../layout/AuthoringFormContext'
import { getAuthoringFieldValue, toTypedAuthoringArrayFieldName } from '../utils/pathUtils'
import {
  getArrayItemDrawerTargetId,
  getFirstArrayItemNavigationTargetId,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import { createDefaultAuthoringArrayItem } from './authoringNodeDefaults'
import {
  getCollectionPresentation,
  getCollectionColumns,
  getCollectionRowCells,
  getCollectionRowDescription,
  getCollectionRowIcon,
  getCollectionRowLabel,
  getCollectionRowMetadata
} from './collectionPresentation'
import { useAuthoringRendererInteractions, useAuthoringRendererScope } from './FormRenderer.context'
import { GroupEditorDrawer } from './GroupEditorDrawer'
import { AuthoringValidationAlert } from './AuthoringValidationAlert'
import * as collectionStyles from './CollectionField.css'
import { getCollectionStyleSet } from './collectionStyleMap'
import { captureGroupEditorSnapshot, restoreGroupEditorTransaction } from './groupEditorTransaction'
import * as styles from './FormRenderer.css'
import { AuthoringActionControl } from './AuthoringActionControl'
import { dispatchCollectionAction } from './authoringActionDispatcher'
import { cloneAuthoringGroupValue } from './authoringCollectionValues'
import {
  resolveAuthoringSurfaceStyle,
  resolveAuthoringTextStyle
} from './authoringPresentationAdapter'
import { useAuthoringPresentationContext } from './useAuthoringPresentationContext'
import { getCollectionItemIdentity, moveAndRenumberCollectionRows } from './collectionOrdering'
import {
  ManualCollectionOrderingProvider,
  ManualCollectionOrderingRow
} from './ManualCollectionOrdering'
import { getResolvedAuthoringScope } from '../authoring-schema/resolvedAuthoringScope'
import { isRecord } from '../utils/valueGuards'
import { toCollectionDomId } from './collectionPresentation'

type ResolvedCollectionOverviewProps = {
  drawerTarget?: AuthoringNavigationTarget
  hideHeading?: boolean
  target: AuthoringNavigationTarget
  validationTargets: readonly AuthoringNavigationTarget[]
}

export function createResolvedCollectionOverview<TValues extends object>(defaultValues: TValues) {
  return withForm({
    defaultValues,
    props: {} as ResolvedCollectionOverviewProps,
    render: function ResolvedCollectionOverview({
      drawerTarget,
      form,
      hideHeading = false,
      target,
      validationTargets
    }) {
      const { goToNavigationTarget, navigationTargets } = useAuthoringNavigation()
      const presentationContext = useAuthoringPresentationContext()
      const { model, readOnly } = useAuthoringRendererScope()
      const { groupEditor, setGroupEditor } = useAuthoringRendererInteractions()
      const node = target.collectionNode
      const collectionFieldName = target.collectionFieldName
      const dismissedDrawerTargetId = useRef<string | undefined>(undefined)
      const [pendingNavigationRowIndex, setPendingNavigationRowIndex] = useState<number>()

      useEffect(() => {
        if (
          pendingNavigationRowIndex === undefined ||
          !node ||
          !collectionFieldName ||
          node.presentation === 'focused'
        ) {
          return
        }

        const targetId = getFirstArrayItemNavigationTargetId({
          collectionFieldName,
          collectionNode: node,
          model,
          rowIndex: pendingNavigationRowIndex
        })
        if (!targetId) return

        goToNavigationTarget(targetId)
        setPendingNavigationRowIndex(undefined)
      }, [collectionFieldName, goToNavigationTarget, model, node, pendingNavigationRowIndex])

      useEffect(() => {
        if (
          !drawerTarget ||
          (dismissedDrawerTargetId.current && dismissedDrawerTargetId.current !== drawerTarget.id)
        ) {
          dismissedDrawerTargetId.current = undefined
        }

        if (
          !drawerTarget ||
          !node ||
          !collectionFieldName ||
          drawerTarget.drawerRowIndex === undefined ||
          dismissedDrawerTargetId.current === drawerTarget.id ||
          groupEditor
        ) {
          return
        }

        if (!isRecord(form.state.values)) return
        const rows = getAuthoringFieldValue(form.state.values, collectionFieldName)
        if (!Array.isArray(rows)) return

        const row = rows[drawerTarget.drawerRowIndex]
        if (row === undefined) return

        const snapshot = captureGroupEditorSnapshot({
          collection: rows,
          collectionFieldName,
          fieldMeta: form.state.fieldMeta,
          rowIndex: drawerTarget.drawerRowIndex
        })
        const label = getCollectionRowLabel(
          node,
          row,
          drawerTarget.drawerRowIndex,
          getResolvedAuthoringScope(
            model,
            node.childMapId,
            `${collectionFieldName}[${drawerTarget.drawerRowIndex}]`
          )
        )
        const opener = document.getElementById(
          `authoring-target-${toCollectionDomId(drawerTarget.id)}`
        )

        setGroupEditor({
          fieldName: collectionFieldName,
          label: `Edit ${label}`,
          mode: 'edit',
          opener,
          rowIndex: drawerTarget.drawerRowIndex,
          ...snapshot
        })
      }, [collectionFieldName, drawerTarget, form, groupEditor, node, setGroupEditor])

      if (!node || !collectionFieldName) return null

      const nodeReadOnly = readOnly
      const collection = getCollectionPresentation(node)
      const collectionColumns = getCollectionColumns(node)
      const collectionStyleSet = getCollectionStyleSet(collection.rowLayout, false)
      const fieldName = collectionFieldName as ReturnType<
        typeof toTypedAuthoringArrayFieldName<TValues>
      >

      return (
        <form.AppField name={fieldName} mode='array'>
          {(field) => {
            const rows = Array.isArray(field.state.value) ? field.state.value : []
            const ordering = node.authoring.collection.ordering
            const usesManualOrdering = ordering.mode === 'manual'
            const editorForField =
              groupEditor?.fieldName === collectionFieldName ? groupEditor : undefined
            const orderingItems = rows.map((row, index) => ({
              id: getCollectionItemIdentity(row, index, ordering),
              label: getCollectionRowLabel(
                node,
                row,
                index,
                getResolvedAuthoringScope(
                  model,
                  node.childMapId,
                  `${collectionFieldName}[${index}]`
                )
              )
            }))
            const showsHeading = !hideHeading && Boolean(collection.heading)
            const usesRowsOnlyPresentation = hideHeading
            const moveRow = (fromIndex: number, toIndex: number) => {
              field.moveValue(fromIndex, toIndex)
              if (ordering.mode === 'manual' && ordering.orderPath) {
                field.setValue(
                  moveAndRenumberCollectionRows(
                    rows,
                    fromIndex,
                    toIndex,
                    ordering.orderPath
                  ) as Parameters<typeof field.setValue>[0],
                  { dontUpdateMeta: true }
                )
              }
            }
            const overviewTargetId = navigationTargets.find(
              (candidate) =>
                candidate.kind === 'overview' &&
                candidate.collectionFieldName === collectionFieldName
            )?.id
            const closeEditor = (restore: boolean) => {
              if (!editorForField) return
              if (restore) {
                if (drawerTarget) dismissedDrawerTargetId.current = drawerTarget.id
                restoreGroupEditorTransaction({
                  currentFieldMeta: form.state.fieldMeta,
                  editor: editorForField,
                  restoreCollection: (collection) =>
                    field.setValue(collection as Parameters<typeof field.setValue>[0], {
                      dontRunListeners: true,
                      dontUpdateMeta: true,
                      dontValidate: true
                    }),
                  restoreFieldMeta: (metaFieldName, meta) =>
                    form.setFieldMeta(
                      metaFieldName as Parameters<typeof form.setFieldMeta>[0],
                      meta
                    )
                })
              }
              const opener = editorForField.opener
              setGroupEditor(undefined)
              if (overviewTargetId) goToNavigationTarget(overviewTargetId)
              window.setTimeout(() => {
                const targetOpener = drawerTarget
                  ? document.getElementById(
                      `authoring-target-${toCollectionDomId(drawerTarget.id)}`
                    )
                  : undefined
                ;(opener?.isConnected ? opener : targetOpener)?.focus()
              }, 0)
            }

            return (
              <div
                className={`${styles.wideField} ${collectionStyles.collectionOverview} ${
                  usesRowsOnlyPresentation
                    ? collectionStyles.collectionOverviewRowsOnly
                    : collectionStyles.collectionOverviewSurface
                }`}
                style={
                  usesRowsOnlyPresentation
                    ? undefined
                    : resolveAuthoringSurfaceStyle(
                        node.authoring.appearance?.surface,
                        presentationContext
                      )
                }
              >
                {showsHeading && collection.heading ? (
                  <Group
                    className={collectionStyles.collectionOverviewHeader}
                    justify='flex-start'
                    align='center'
                    mb='xs'
                  >
                    <Group gap='xs'>
                      <span className={collectionStyles.collectionHeadingIcon} aria-hidden='true'>
                        {collection.headingIcon === 'controls' ? (
                          <SlidersHorizontal size={19} />
                        ) : (
                          <CircleHelp size={18} />
                        )}
                      </span>
                      <Text
                        component='h3'
                        className={collectionStyles.collectionHeading}
                        style={resolveAuthoringTextStyle(
                          node.authoring.appearance?.heading,
                          presentationContext
                        )}
                      >
                        {collection.heading}
                      </Text>
                      <CircleHelp
                        className={collectionStyles.collectionHeadingHelpIcon}
                        size={15}
                        aria-label={`About ${collection.heading}`}
                      />
                    </Group>
                  </Group>
                ) : null}
                <AuthoringValidationAlert target={target} validationTargets={validationTargets} />
                {rows.length > 0 && collectionColumns.length > 0 ? (
                  <div className={collectionStyles.collectionLedgerHeader} aria-hidden='true'>
                    <span />
                    <span className={collectionStyles.collectionLedgerCells}>
                      {collectionColumns.map((column) => (
                        <span
                          className={collectionStyles.collectionLedgerColumnLabel}
                          key={column.key}
                        >
                          {column.label}
                        </span>
                      ))}
                    </span>
                    <span />
                  </div>
                ) : null}
                {rows.length === 0 ? (
                  <Text className={collectionStyles.collectionEmptyLabel} size='sm' c='dimmed'>
                    {collection.emptyLabel}
                  </Text>
                ) : (
                  <ManualCollectionOrderingProvider
                    disabled={nodeReadOnly || groupEditor !== undefined}
                    enabled={usesManualOrdering}
                    items={orderingItems}
                    onMove={moveRow}
                  >
                    <div className={collectionStyleSet.list}>
                      {rows.map((row, index) => {
                        const label = getCollectionRowLabel(node, row, index)
                        const description = getCollectionRowDescription(node, row)
                        const metadata = getCollectionRowMetadata(node, row)
                        const rowCells = getCollectionRowCells(node, row, label)
                        const rowIcon = getCollectionRowIcon(node, row)
                        const usesDrawer = node.presentation === 'focused'
                        const targetId = usesDrawer
                          ? getArrayItemDrawerTargetId({
                              collectionFieldName,
                              collectionNode: node,
                              rowIndex: index
                            })
                          : getFirstArrayItemNavigationTargetId({
                              collectionFieldName,
                              collectionNode: node,
                              model,
                              rowIndex: index
                            })
                        const isEditing = editorForField?.rowIndex === index

                        const rowContent = (
                          <div
                            className={`${collectionStyleSet.item} ${collectionStyles.collectionCard}`}
                            data-editing={isEditing || undefined}
                          >
                            <div
                              className={`${collectionStyleSet.itemHeader} ${
                                rowCells.length > 0 ? collectionStyles.collectionLedgerRow : ''
                              }`}
                            >
                              <span
                                className={collectionStyles.collectionCardIcon}
                                aria-hidden='true'
                              >
                                {rowIcon === 'sword' ? (
                                  <Sword size={21} />
                                ) : rowIcon === 'sparkles' ? (
                                  <Sparkles size={21} />
                                ) : (
                                  <Box size={20} />
                                )}
                              </span>
                              <button
                                id={
                                  usesDrawer && targetId
                                    ? `authoring-target-${toCollectionDomId(targetId)}`
                                    : undefined
                                }
                                aria-label={usesDrawer ? `Open ${label}` : undefined}
                                type='button'
                                className={`${collectionStyles.collectionItemBodyTrigger} ${
                                  rowCells.length > 0
                                    ? collectionStyles.collectionLedgerTrigger
                                    : ''
                                }`}
                                onClick={(event) => {
                                  if (usesDrawer) {
                                    const snapshot = captureGroupEditorSnapshot({
                                      collection: rows,
                                      collectionFieldName,
                                      fieldMeta: form.state.fieldMeta,
                                      rowIndex: index
                                    })
                                    setGroupEditor({
                                      fieldName: collectionFieldName,
                                      label: `Edit ${label}`,
                                      mode: 'edit',
                                      opener: event.currentTarget,
                                      rowIndex: index,
                                      ...snapshot
                                    })
                                  }
                                  if (targetId) goToNavigationTarget(targetId)
                                }}
                              >
                                {rowCells.length > 0 ? (
                                  <span className={collectionStyles.collectionLedgerCells}>
                                    {rowCells.map((cell, cellIndex) => (
                                      <span
                                        className={
                                          cellIndex === 0
                                            ? collectionStyles.collectionLedgerPrimaryCell
                                            : collectionStyles.collectionLedgerCell
                                        }
                                        data-label={cell.label}
                                        key={cell.key}
                                      >
                                        {cell.value}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  <span>
                                    <Text className={collectionStyles.collectionItemTitle}>
                                      {label}
                                    </Text>
                                    {metadata.length > 0 ? (
                                      <span className={collectionStyles.collectionCardMeta}>
                                        {metadata.map((item) => (
                                          <span
                                            key={item}
                                            className={collectionStyles.collectionCardChip}
                                          >
                                            {item}
                                          </span>
                                        ))}
                                      </span>
                                    ) : description ? (
                                      <Text className={collectionStyles.collectionItemDescription}>
                                        {description}
                                      </Text>
                                    ) : null}
                                  </span>
                                )}
                              </button>
                              {!nodeReadOnly ? (
                                <div className={collectionStyles.collectionCardActions}>
                                  {usesDrawer && collection.editAction ? (
                                    <AuthoringActionControl
                                      action={{
                                        ...collection.editAction,
                                        label: `Edit ${label}`
                                      }}
                                      className={styles.inlineArrayRemoveAction}
                                      icon={<Pencil size={16} aria-hidden='true' />}
                                      onClick={(event) =>
                                        dispatchCollectionAction(collection.editAction!, event, {
                                          'collection.edit': (actionEvent) => {
                                            const snapshot = captureGroupEditorSnapshot({
                                              collection: rows,
                                              collectionFieldName,
                                              fieldMeta: form.state.fieldMeta,
                                              rowIndex: index
                                            })
                                            setGroupEditor({
                                              fieldName: collectionFieldName,
                                              label: `Edit ${label}`,
                                              mode: 'edit',
                                              opener: actionEvent.currentTarget,
                                              rowIndex: index,
                                              ...snapshot
                                            })
                                            if (targetId) {
                                              goToNavigationTarget(targetId)
                                            }
                                          }
                                        })
                                      }
                                    />
                                  ) : null}
                                  {collection.duplicateAction ? (
                                    <AuthoringActionControl
                                      action={{
                                        ...collection.duplicateAction,
                                        label: `Duplicate ${label}`
                                      }}
                                      className={styles.inlineArrayRemoveAction}
                                      icon={<Copy size={16} aria-hidden='true' />}
                                      onClick={(event) =>
                                        dispatchCollectionAction(
                                          collection.duplicateAction!,
                                          event,
                                          {
                                            'collection.duplicate': () =>
                                              field.pushValue(
                                                cloneAuthoringGroupValue(
                                                  row,
                                                  rows.length + 1
                                                ) as Parameters<typeof field.pushValue>[0]
                                              )
                                          }
                                        )
                                      }
                                    />
                                  ) : null}
                                  {collection.removeAction ? (
                                    <AuthoringActionControl
                                      action={{
                                        ...collection.removeAction,
                                        label: `Remove ${label}`
                                      }}
                                      className={styles.inlineArrayRemoveAction}
                                      icon={<Trash2 size={16} aria-hidden='true' />}
                                      onClick={(event) =>
                                        dispatchCollectionAction(collection.removeAction!, event, {
                                          'collection.remove': () => {
                                            if (
                                              drawerTarget?.drawerRowIndex === index &&
                                              overviewTargetId
                                            ) {
                                              setGroupEditor(undefined)
                                              goToNavigationTarget(overviewTargetId)
                                            }
                                            field.removeValue(index)
                                          }
                                        })
                                      }
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )

                        return usesManualOrdering ? (
                          <ManualCollectionOrderingRow
                            disabled={nodeReadOnly || groupEditor !== undefined}
                            id={orderingItems[index]?.id ?? String(index)}
                            index={index}
                            key={orderingItems[index]?.id ?? String(index)}
                            label={label}
                          >
                            {rowContent}
                          </ManualCollectionOrderingRow>
                        ) : (
                          <div key={getGroupRowKey(row, index)}>{rowContent}</div>
                        )
                      })}
                    </div>
                  </ManualCollectionOrderingProvider>
                )}
                {!nodeReadOnly && collection.addAction ? (
                  <div className={collectionStyles.collectionAddRow}>
                    <AuthoringActionControl
                      action={{
                        ...collection.addAction,
                        label: `Add ${collection.itemLabel.toLowerCase()}`
                      }}
                      className={collectionStyles.collectionAddAction}
                      icon={<Plus size={15} aria-hidden='true' />}
                      onClick={(event) =>
                        dispatchCollectionAction(collection.addAction!, event, {
                          'collection.add': (actionEvent) => {
                            const rowIndex = rows.length
                            const snapshot = captureGroupEditorSnapshot({
                              collection: rows,
                              collectionFieldName,
                              fieldMeta: form.state.fieldMeta,
                              rowIndex
                            })
                            field.pushValue(
                              createDefaultAuthoringArrayItem(node, rowIndex) as Parameters<
                                typeof field.pushValue
                              >[0]
                            )
                            const usesDrawer = node.presentation === 'focused'
                            if (usesDrawer) {
                              setGroupEditor({
                                fieldName: collectionFieldName,
                                label: `Add ${collection.itemLabel}`,
                                mode: 'add',
                                opener: actionEvent.currentTarget,
                                rowIndex,
                                ...snapshot
                              })
                            }
                            const targetId = usesDrawer
                              ? getArrayItemDrawerTargetId({
                                  collectionFieldName,
                                  collectionNode: node,
                                  rowIndex
                                })
                              : getFirstArrayItemNavigationTargetId({
                                  collectionFieldName,
                                  collectionNode: node,
                                  model,
                                  rowIndex
                                })
                            if (targetId) {
                              goToNavigationTarget(targetId)
                            } else if (!usesDrawer) {
                              setPendingNavigationRowIndex(rowIndex)
                            }
                          }
                        })
                      }
                    />
                  </div>
                ) : null}
                {drawerTarget && editorForField ? (
                  <GroupEditorDrawer
                    editor={editorForField}
                    fieldPath={`${collectionFieldName}[${editorForField.rowIndex}]`}
                    node={node}
                    onClose={closeEditor}
                    validationTarget={drawerTarget}
                    validationTargets={validationTargets}
                  />
                ) : null}
              </div>
            )
          }}
        </form.AppField>
      )
    }
  })
}

function getGroupRowKey(row: unknown, index: number) {
  return isRecord(row) && typeof row.id === 'string' ? row.id : String(index)
}
