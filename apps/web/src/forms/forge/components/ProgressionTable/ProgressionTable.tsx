import { ActionIcon, Button, Drawer, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Pencil, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  shouldUseProgressionSummary,
  useProgressionResponsiveMode
} from './ProgressionTable.responsive'
import type { EditableTableRow, ProgressionRowEditorMode, ProgressionTableProps } from './ProgressionTable.types'
import * as styles from './ProgressionTable.css'

export function ProgressionTable({
  addLabel = 'Add row',
  ariaLabel,
  columns,
  createDraftRow,
  editorTitle,
  forceMode,
  getRowSummary,
  getRowTitle,
  onCommitRow,
  renderRowEditor,
  renderRowActions,
  rows,
  saveLabel = 'Save row'
}: ProgressionTableProps) {
  const responsiveMode = useProgressionResponsiveMode(forceMode)
  const usesSummaryList = shouldUseProgressionSummary(responsiveMode)
  const [drawerOpen, { close: closeDrawer, open: openDrawer }] = useDisclosure(false)
  const [selectedRow, setSelectedRow] = useState<(typeof rows)[number] | null>(null)
  const [draftRow, setDraftRow] = useState<EditableTableRow | null>(null)
  const [editorMode, setEditorMode] = useState<ProgressionRowEditorMode>('edit')
  const hasActions = Boolean(renderRowActions)
  const gridTemplateColumns = [
    ...columns.map((column) => column.width ?? 'minmax(0, 1fr)'),
    ...(hasActions ? ['28px'] : [])
  ].join(' ')
  const tableStyle = { '--forge-table-columns': gridTemplateColumns } as CSSProperties
  const tableLayout = usesSummaryList ? responsiveMode : 'table'
  const drawerPosition = responsiveMode === 'mobilePortrait' ? 'bottom' : 'right'
  const drawerSize = responsiveMode === 'mobilePortrait' ? 'min(64dvh, 28rem)' : 'min(28rem, 92vw)'
  const drawerContentClassName = responsiveMode === 'mobilePortrait'
    ? styles.editorDrawerContentMobilePortrait
    : styles.editorDrawerContent
  const canOpenEditor = Boolean(renderRowEditor)

  function openEditor(row: (typeof rows)[number] | null, mode: ProgressionRowEditorMode) {
    if (!canOpenEditor) return

    setSelectedRow(row)
    setDraftRow(row ? { ...row } : createDraftRow?.() ?? createFallbackDraftRow(rows))
    setEditorMode(mode)
    openDrawer()
  }

  function closeEditor() {
    closeDrawer()
    setSelectedRow(null)
    setDraftRow(null)
  }

  function setDraftRowValue(key: string, value: unknown) {
    setDraftRow((current) => current ? { ...current, [key]: value } : current)
  }

  function commitEditor() {
    if (!draftRow) return

    onCommitRow?.({ draftRow, mode: editorMode, sourceRow: selectedRow })
    closeEditor()
  }

  function getEditorTitle() {
    if (typeof editorTitle === 'function') return editorTitle(selectedRow, editorMode)
    if (editorTitle) return editorTitle
    if (editorMode === 'create') return addLabel

    const title = selectedRow && getRowTitle ? getRowTitle(selectedRow) : null
    return title ? `Edit ${title}` : 'Edit row'
  }

  return (
    <>
      <div
        className={styles.sectionTable}
        aria-label={ariaLabel}
        data-layout={tableLayout}
        style={tableStyle}
      >
        {usesSummaryList ? (
          <ul className={styles.summaryList}>
            {rows.map((row) => {
              const rowTitle = getRowTitle?.(row) ?? row.id

              return (
                <li className={styles.summaryItem} key={row.id}>
                  <div className={styles.summaryCopy}>
                    <span className={styles.summaryTitle}>{rowTitle}</span>
                    <span className={styles.summaryText}>{getRowSummary?.(row)}</span>
                  </div>
                  <div className={styles.summaryActions}>
                    {renderRowEditor ? (
                      <ActionIcon
                        aria-label={`Edit ${rowTitle}`}
                        className={styles.summaryIconButton}
                        onClick={() => openEditor(row, 'edit')}
                        variant='subtle'
                      >
                        <Pencil aria-hidden='true' size={15} />
                      </ActionIcon>
                    ) : null}
                    {renderRowActions ? renderRowActions(row) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <div className={styles.sectionTableHeader} aria-hidden='true'>
              {columns.map((column) => (
                <span
                  className={styles.sectionTableHeaderCell}
                  data-align={column.align ?? 'start'}
                  key={column.id}
                >
                  {column.label}
                </span>
              ))}
              {hasActions ? <span className={styles.sectionTableHeaderCell} /> : null}
            </div>
            {rows.map((row) => (
              <div className={styles.sectionTableRow} key={row.id}>
                {columns.map((column) => (
                  <span
                    className={styles.sectionTableRowCell}
                    data-align={column.align ?? 'start'}
                    key={column.id}
                  >
                    {column.renderCell(row)}
                  </span>
                ))}
                {renderRowActions ? <span>{renderRowActions(row)}</span> : null}
              </div>
            ))}
          </>
        )}

        <UnstyledButton
          className={styles.addRow}
          onClick={() => openEditor(null, 'create')}
          type='button'
        >
          <span className={styles.addIcon}>
            <Plus aria-hidden='true' size={16} />
          </span>
          <span className={styles.addCopy}>
            <span className={styles.addTitle}>{addLabel}</span>
          </span>
        </UnstyledButton>
      </div>

      <Drawer
        classNames={{
          body: styles.editorDrawerBody,
          content: drawerContentClassName,
          header: styles.editorDrawerHeader,
          title: styles.editorDrawerTitle
        }}
        onClose={closeEditor}
        opened={drawerOpen}
        position={drawerPosition}
        size={drawerSize}
        title={getEditorTitle()}
        withinPortal
      >
        {draftRow && renderRowEditor
          ? (
              <div className={styles.editorDrawerStack}>
                {renderRowEditor({
                  draftRow,
                  mode: editorMode,
                  setDraftRowValue,
                  sourceRow: selectedRow
                })}
                <div className={styles.editorDrawerFooter}>
                  <Button
                    className={styles.editorDrawerButton}
                    type='button'
                    variant='default'
                    onClick={closeEditor}
                  >
                    Cancel
                  </Button>
                  <Button className={styles.editorDrawerButton} type='button' onClick={commitEditor}>
                    {editorMode === 'create' ? addLabel : saveLabel}
                  </Button>
                </div>
              </div>
            )
          : null}
      </Drawer>
    </>
  )
}

function createFallbackDraftRow(rows: readonly EditableTableRow[]): EditableTableRow {
  return {
    id: `draft-${rows.length + 1}`
  }
}
