import { Fragment } from 'react'
import { Button, Collapse, Group, Modal, Text } from '@mantine/core'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { NodeRuntimeArrayGroupNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { withForm } from '../app-form/AppForm'
import { toAuthoringFieldName, toTypedAuthoringArrayFieldName } from '../utils/pathUtils'
import { createDefaultAuthoringArrayItem } from './authoringNodeDefaults'
import { getCollectionPresentation, getCollectionRowLabel } from './collectionPresentation'
import * as collectionStyles from './CollectionField.css'
import { getCollectionStyleSet } from './collectionStyleMap'
import { useAuthoringRendererInteractions, useAuthoringRendererScope } from './FormRenderer.context'
import { GroupEditorDrawer } from './GroupEditorDrawer'
import { captureGroupEditorSnapshot, restoreGroupEditorTransaction } from './groupEditorTransaction'
import type { AuthoringNavigationTarget } from '../layout/authoringNavigation'
import * as styles from './FormRenderer.css'
import { AuthoringActionControl } from './AuthoringActionControl'
import { dispatchCollectionAction } from './authoringActionDispatcher'
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

type ResolvedArrayGroupProps = {
  hideHeading?: boolean
  node: NodeRuntimeArrayGroupNodeDto
  validationTargets: readonly AuthoringNavigationTarget[]
}

export function createResolvedArrayGroup<TValues extends object>(defaultValues: TValues) {
  return withForm({
    defaultValues,
    props: {} as ResolvedArrayGroupProps,
    render: function ResolvedArrayGroup({ form, hideHeading = false, node, validationTargets }) {
      const {
        childAncestors,
        fieldPathPrefix,
        model,
        readOnly,
        renderChild,
        renderAllSteps,
        values
      } = useAuthoringRendererScope()
      const {
        expandedInlineRowIds,
        groupEditor,
        groupRemoval,
        setExpandedInlineRowIds,
        setGroupEditor,
        setGroupRemoval
      } = useAuthoringRendererInteractions()
      const presentationContext = useAuthoringPresentationContext()

      const childMapId = node.childMapId
      const nodeReadOnly = readOnly
      const fieldName = toTypedAuthoringArrayFieldName<TValues>(fieldPathPrefix, node.path)

      return (
        <form.AppField name={fieldName} mode='array'>
          {(field) => {
            const rows = Array.isArray(field.state.value) ? field.state.value : []
            const usesDrawerEditor = node.presentation === 'summary'
            const usesCompactTable = node.presentation === 'table'
            const collection = getCollectionPresentation(node)
            const addAction = collection.addAction
            const ordering = node.authoring.collection.ordering
            const usesManualOrdering = ordering.mode === 'manual'
            const usesCardRows = collection.rowLayout === 'card'
            const usesFlatRows = collection.rowLayout === 'flat'
            const usesCompactRows = collection.rowLayout === 'compact'
            const collectionHeading = hideHeading ? null : collection.heading
            const canAdd = !nodeReadOnly && collection.addAction !== undefined
            const classSet = getCollectionStyleSet(collection.rowLayout, usesCompactTable)
            const editorForField =
              groupEditor?.fieldName === String(fieldName) ? groupEditor : undefined
            const rowScopeOf = (index: number) =>
              getResolvedAuthoringScope(
                model,
                childMapId,
                toAuthoringFieldName(fieldPathPrefix, [...node.path, index])
              )
            const orderingItems = rows.map((row, index) => ({
              id: getCollectionItemIdentity(row, index, ordering),
              label: getCollectionRowLabel(node, row, index, rowScopeOf(index))
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
              window.setTimeout(() => opener?.focus(), 0)
            }

            return (
              <div
                className={`${styles.wideField} ${classSet.container}`}
                style={resolveAuthoringSurfaceStyle(
                  node.authoring.appearance?.surface,
                  presentationContext
                )}
              >
                {collectionHeading !== null || canAdd ? (
                  <Group
                    className={classSet.header || undefined}
                    justify={collectionHeading === null ? 'flex-end' : 'space-between'}
                    align='center'
                    mb={hideHeading || usesCardRows || usesFlatRows || usesCompactRows ? 0 : 'xs'}
                  >
                    {collectionHeading === null ? null : (
                      <Text
                        fw={700}
                        style={resolveAuthoringTextStyle(
                          node.authoring.appearance?.heading,
                          presentationContext
                        )}
                      >
                        {collectionHeading}
                      </Text>
                    )}
                    {canAdd && addAction ? (
                      <AuthoringActionControl
                        action={addAction}
                        icon={<Plus size={15} aria-hidden='true' />}
                        onClick={(event) =>
                          dispatchCollectionAction(addAction, event, {
                            'collection.add': (actionEvent) => {
                              const rowIndex = rows.length
                              const snapshot = captureGroupEditorSnapshot({
                                collection: rows,
                                collectionFieldName: String(fieldName),
                                fieldMeta: form.state.fieldMeta,
                                rowIndex
                              })
                              field.pushValue(
                                createDefaultAuthoringArrayItem(node, rowIndex) as Parameters<
                                  typeof field.pushValue
                                >[0]
                              )
                              if (usesDrawerEditor) {
                                setGroupEditor({
                                  fieldName: String(fieldName),
                                  label: addAction.label,
                                  mode: 'add',
                                  opener: actionEvent.currentTarget,
                                  rowIndex,
                                  ...snapshot
                                })
                              }
                            }
                          })
                        }
                      />
                    ) : null}
                  </Group>
                ) : null}
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
                    <div className={classSet.list}>
                      {rows.map((row, index) => {
                        const rowPrefix = toAuthoringFieldName(fieldPathPrefix, [
                          ...node.path,
                          index
                        ])
                        const rowId = `${rowPrefix}:${getGroupRowKey(row, index)}`
                        const isRowExpanded =
                          collection.rowExpansion === 'expanded' ||
                          expandedInlineRowIds.has(rowId) ||
                          (renderAllSteps && rows.length === 1 && !usesCompactTable)
                        const rowLabel = getCollectionRowLabel(node, row, index, rowScopeOf(index))
                        const rowBodyId = `authoring-group-row-${toCollectionDomId(rowId)}`
                        const usesFlatRow = usesFlatRows || usesCompactRows
                        const canRemoveRow = !nodeReadOnly && collection.removeAction !== undefined

                        const toggleRow = () => {
                          setExpandedInlineRowIds((current) => {
                            const next = new Set(current)
                            if (next.has(rowId)) next.delete(rowId)
                            else next.add(rowId)
                            return next
                          })
                        }

                        const rowContent = (
                          <Fragment>
                            {index > 0 && collection.join ? (
                              <div
                                aria-label={`${collection.join} ${collection.itemLabel}`}
                                className={classSet.separator}
                                role='separator'
                              >
                                <span>{collection.join}</span>
                              </div>
                            ) : null}
                            <div className={classSet.item}>
                              <div className={classSet.itemHeader}>
                                {usesCardRows ? (
                                  <Text className={collectionStyles.collectionItemTitle}>
                                    {rowLabel}
                                  </Text>
                                ) : usesFlatRow ? null : usesCompactTable ? (
                                  <div className={collectionStyles.collectionItemBodyTrigger}>
                                    <Text className={collectionStyles.collectionItemTitle}>
                                      {rowLabel}
                                    </Text>
                                  </div>
                                ) : (
                                  <button
                                    type='button'
                                    className={collectionStyles.collectionItemBodyTrigger}
                                    aria-controls={usesDrawerEditor ? undefined : rowBodyId}
                                    aria-expanded={usesDrawerEditor ? undefined : isRowExpanded}
                                    aria-haspopup={usesDrawerEditor ? 'dialog' : undefined}
                                    onClick={(event) => {
                                      if (usesDrawerEditor) {
                                        const snapshot = captureGroupEditorSnapshot({
                                          collection: rows,
                                          collectionFieldName: String(fieldName),
                                          fieldMeta: form.state.fieldMeta,
                                          rowIndex: index
                                        })
                                        setGroupEditor({
                                          fieldName: String(fieldName),
                                          label: `Edit ${rowLabel}`,
                                          mode: 'edit',
                                          opener: event.currentTarget,
                                          rowIndex: index,
                                          ...snapshot
                                        })
                                        return
                                      }
                                      toggleRow()
                                    }}
                                  >
                                    <ChevronDown
                                      size={16}
                                      aria-hidden='true'
                                      className={
                                        isRowExpanded
                                          ? `${collectionStyles.collectionItemChevron} ${collectionStyles.collectionItemChevronOpen}`
                                          : collectionStyles.collectionItemChevron
                                      }
                                    />
                                    <Text className={collectionStyles.collectionItemTitle}>
                                      {rowLabel}
                                    </Text>
                                    <span
                                      className={collectionStyles.collectionItemBodyActionLabel}
                                      aria-hidden='true'
                                    >
                                      {isRowExpanded ? 'Close' : 'Edit'}
                                    </span>
                                  </button>
                                )}
                                {canRemoveRow && collection.removeAction ? (
                                  <AuthoringActionControl
                                    action={{
                                      ...collection.removeAction,
                                      label: collection.removeAction.label || `Remove ${rowLabel}`
                                    }}
                                    className={styles.inlineArrayRemoveAction}
                                    icon={<Trash2 size={16} aria-hidden='true' />}
                                    onClick={(event) =>
                                      dispatchCollectionAction(collection.removeAction!, event, {
                                        'collection.remove': () =>
                                          setGroupRemoval({
                                            fieldName: String(fieldName),
                                            kind: collection.itemLabel,
                                            label: rowLabel,
                                            rowIndex: index
                                          })
                                      })
                                    }
                                  />
                                ) : null}
                              </div>
                              {!usesDrawerEditor ? (
                                <Collapse
                                  id={rowBodyId}
                                  expanded={usesCompactTable || isRowExpanded}
                                  keepMounted
                                  transitionDuration={140}
                                  transitionTimingFunction='cubic-bezier(0.2, 0, 0, 1)'
                                >
                                  <div className={classSet.itemBody}>
                                    {renderChild({
                                      ancestors: [values, ...(childAncestors ?? [])],
                                      fieldPathPrefix: rowPrefix,
                                      mapId: childMapId,
                                      parentValues: values,
                                      readOnly: nodeReadOnly,
                                      renderAllSteps: true
                                    })}
                                  </div>
                                </Collapse>
                              ) : null}
                            </div>
                          </Fragment>
                        )

                        return usesManualOrdering ? (
                          <ManualCollectionOrderingRow
                            disabled={nodeReadOnly || groupEditor !== undefined}
                            id={orderingItems[index]?.id ?? rowId}
                            index={index}
                            key={orderingItems[index]?.id ?? rowId}
                            label={rowLabel}
                          >
                            {rowContent}
                          </ManualCollectionOrderingRow>
                        ) : (
                          <Fragment key={getGroupRowKey(row, index)}>{rowContent}</Fragment>
                        )
                      })}
                    </div>
                  </ManualCollectionOrderingProvider>
                )}
                {usesDrawerEditor && editorForField ? (
                  <GroupEditorDrawer
                    editor={editorForField}
                    fieldPath={toAuthoringFieldName(fieldPathPrefix, [
                      ...node.path,
                      editorForField.rowIndex
                    ])}
                    node={node}
                    onClose={closeEditor}
                    validationTargets={validationTargets}
                  />
                ) : null}
                <Modal
                  opened={groupRemoval?.fieldName === String(fieldName)}
                  onClose={() => setGroupRemoval(undefined)}
                  centered
                  title={
                    groupRemoval?.kind
                      ? `Remove this ${groupRemoval.kind}?`
                      : `Remove ${groupRemoval?.label ?? collection.itemLabel}?`
                  }
                >
                  <Text size='sm'>
                    {groupRemoval?.kind
                      ? `This will discard ${groupRemoval.label.toLowerCase()} and all of its configured values.`
                      : 'This will discard all configured values for this item.'}
                  </Text>
                  <Group justify='flex-end' mt='md'>
                    <Button variant='default' onClick={() => setGroupRemoval(undefined)}>
                      Cancel
                    </Button>
                    <Button
                      color='red'
                      onClick={() => {
                        if (groupRemoval?.rowIndex !== undefined) {
                          field.removeValue(groupRemoval.rowIndex)
                        }
                        setGroupRemoval(undefined)
                      }}
                    >
                      {groupRemoval?.kind ? `Remove ${groupRemoval.kind}` : 'Remove'}
                    </Button>
                  </Group>
                </Modal>
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
