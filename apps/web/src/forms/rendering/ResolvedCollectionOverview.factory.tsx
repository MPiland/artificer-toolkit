import { Group, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
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
import { useAuthoringForm } from '../layout/AuthoringFormContext'
import { getAuthoringFieldValue, toTypedAuthoringArrayFieldName } from '../utils/pathUtils'
import {
  getArrayItemDrawerTargetId,
  getFirstArrayItemNavigationTargetId,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import { createDefaultAuthoringArrayItem } from './authoringNodeDefaults'
import {
  getCollectionPresentation,
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

type ResolvedCollectionOverviewProps = {
  drawerTarget?: AuthoringNavigationTarget
  target: AuthoringNavigationTarget
  validationTargets: readonly AuthoringNavigationTarget[]
}

export function createResolvedCollectionOverview<TValues extends object>(defaultValues: TValues) {
  return withForm({
    defaultValues,
    props: {} as ResolvedCollectionOverviewProps,
    render: function ResolvedCollectionOverview({ drawerTarget, form, target, validationTargets }) {
      const authoring = useAuthoringForm()
      const presentationContext = useAuthoringPresentationContext()
      const { model, readOnly } = useAuthoringRendererScope()
      const { groupEditor, setGroupEditor } = useAuthoringRendererInteractions()
      const node = target.collectionNode
      const collectionFieldName = target.collectionFieldName
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

        authoring.goToNavigationTarget(targetId)
        setPendingNavigationRowIndex(undefined)
      }, [authoring, collectionFieldName, model, node, pendingNavigationRowIndex])

      useEffect(() => {
        if (
          !drawerTarget ||
          !node ||
          !collectionFieldName ||
          drawerTarget.drawerRowIndex === undefined ||
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
        const label = getCollectionRowLabel(node, row, drawerTarget.drawerRowIndex)
        const opener = document.getElementById(`authoring-target-${toDomId(drawerTarget.id)}`)

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
              label: getCollectionRowLabel(node, row, index)
            }))
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
            const overviewTargetId = authoring.navigationTargets?.find(
              (candidate) =>
                candidate.kind === 'overview' &&
                candidate.collectionFieldName === collectionFieldName
            )?.id
            const closeEditor = (restore: boolean) => {
              if (!editorForField) return
              if (restore) {
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
              if (overviewTargetId) authoring.goToNavigationTarget(overviewTargetId)
              window.setTimeout(() => {
                const targetOpener = drawerTarget
                  ? document.getElementById(`authoring-target-${toDomId(drawerTarget.id)}`)
                  : undefined
                ;(opener?.isConnected ? opener : targetOpener)?.focus()
              }, 0)
            }

            return (
              <div
                className={`${styles.sectionStack} ${styles.wideField}`}
                style={resolveAuthoringSurfaceStyle(
                  node.authoring.appearance?.surface,
                  presentationContext
                )}
              >
                <section>
                  <div className={styles.fieldGrid}>
                    <div className={styles.wideField}>
                      <Group
                        className={collectionStyles.collectionOverviewHeader}
                        justify='space-between'
                        align='center'
                        mb='xs'
                      >
                        <Group gap='xs'>
                          <span
                            className={collectionStyles.collectionHeadingIcon}
                            aria-hidden='true'
                          >
                            {collection.headingIcon === 'controls' ? (
                              <SlidersHorizontal size={19} />
                            ) : (
                              <CircleHelp size={18} />
                            )}
                          </span>
                          <Text
                            component='h2'
                            className={collectionStyles.collectionHeading}
                            style={resolveAuthoringTextStyle(
                              node.authoring.appearance?.heading,
                              presentationContext
                            )}
                          >
                            {node.label}
                          </Text>
                          <CircleHelp
                            className={collectionStyles.collectionHeadingHelpIcon}
                            size={15}
                            aria-label={`About ${node.label}`}
                          />
                        </Group>
                        <span
                          aria-hidden='true'
                          className={collectionStyles.collectionOverviewHeaderRule}
                        />
                        {!nodeReadOnly && collection.addAction ? (
                          <AuthoringActionControl
                            action={collection.addAction}
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
                                      label:
                                        collection.addAction?.label ??
                                        `Add ${collection.itemLabel}`,
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
                                    authoring.goToNavigationTarget(targetId)
                                  } else if (!usesDrawer) {
                                    setPendingNavigationRowIndex(rowIndex)
                                  }
                                }
                              })
                            }
                          />
                        ) : null}
                      </Group>
                      <AuthoringValidationAlert
                        target={target}
                        validationTargets={validationTargets}
                      />
                      {rows.length === 0 ? (
                        <Text size='sm' c='dimmed'>
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
                                  <div className={collectionStyleSet.itemHeader}>
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
                                          ? `authoring-target-${toDomId(targetId)}`
                                          : undefined
                                      }
                                      aria-label={usesDrawer ? `Open ${label}` : undefined}
                                      type='button'
                                      className={collectionStyles.collectionItemBodyTrigger}
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
                                        if (targetId) authoring.goToNavigationTarget(targetId)
                                      }}
                                    >
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
                                          <Text
                                            className={collectionStyles.collectionItemDescription}
                                          >
                                            {description}
                                          </Text>
                                        ) : null}
                                      </span>
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
                                              dispatchCollectionAction(
                                                collection.editAction!,
                                                event,
                                                {
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
                                                      authoring.goToNavigationTarget(targetId)
                                                    }
                                                  }
                                                }
                                              )
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
                                              dispatchCollectionAction(
                                                collection.removeAction!,
                                                event,
                                                {
                                                  'collection.remove': () =>
                                                    field.removeValue(index)
                                                }
                                              )
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
                  </div>
                </section>
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

function toDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
