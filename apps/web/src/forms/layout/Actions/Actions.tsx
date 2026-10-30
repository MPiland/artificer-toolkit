import type { ReactNode } from 'react'
import { ActionIcon, Button, Menu, Tooltip } from '@mantine/core'
import { Ellipsis, Eye, PanelLeft, RotateCcw, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import {
  useAuthoringActions,
  useAuthoringSession,
  useAuthoringStagedEditor
} from '../AuthoringFormContext'

import { useAuthoringFormStatus } from '../useAuthoringFormStatus'
import * as styles from './Actions.css'
import { useAuthoringLayout } from '../AuthoringLayoutContext'

type HeaderIconActionProps = {
  ariaControls?: string
  ariaExpanded?: boolean
  children: ReactNode
  disabled?: boolean
  isActive?: boolean
  isDestructive?: boolean
  label: string
  loading?: boolean
  onClick?: () => void
}

function HeaderIconAction({
  ariaControls,
  ariaExpanded,
  children,
  disabled = false,
  isActive = false,
  isDestructive = false,
  label,
  loading = false,
  onClick
}: HeaderIconActionProps) {
  return (
    <Tooltip
      label={label}
      classNames={{
        tooltip: styles.tooltipTarget
      }}
    >
      <ActionIcon
        aria-controls={ariaControls}
        aria-label={label}
        aria-expanded={ariaExpanded}
        aria-disabled={disabled && !loading ? true : undefined}
        className={clsx(styles.headerIconButton, { ['isDestructive']: isDestructive })}
        data-active={isActive ? true : undefined}
        data-disabled={disabled && !loading ? true : undefined}
        disabled={!isDestructive && disabled}
        loading={loading}
        onClick={!disabled ? onClick : undefined}
        type='button'
        variant='transparent'
      >
        {children}
      </ActionIcon>
    </Tooltip>
  )
}

export function StepsNavigationAction() {
  const { isWideDesktop, stepsNavigationOpen, toggleStepsNavigation } = useAuthoringLayout()
  if (isWideDesktop) return null

  const label = stepsNavigationOpen ? 'Hide steps' : 'Show steps'

  return (
    <HeaderIconAction
      ariaControls='authoring-steps-navigation'
      ariaExpanded={stepsNavigationOpen}
      isActive={stepsNavigationOpen}
      label={label}
      onClick={toggleStepsNavigation}
    >
      <PanelLeft size={14} aria-hidden='true' />
    </HeaderIconAction>
  )
}

export function ResetActionMenu() {
  const { readOnly } = useAuthoringSession()
  const { resetStep } = useAuthoringActions()
  const { canResetForm, canResetStep, hasChanges, hasStepChanges } = useAuthoringFormStatus()
  const { toggleResetFormConfirm } = useAuthoringLayout()
  if (readOnly || (!canResetStep && !canResetForm)) return null

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon
          aria-label='Reset actions'
          className={styles.headerIconButton}
          variant='transparent'
        >
          <RotateCcw size={14} aria-hidden='true' />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={!hasStepChanges || readOnly || !canResetStep}
          aria-label='Reset step'
          onClick={resetStep}
        >
          Reset step
        </Menu.Item>
        <Menu.Item
          disabled={!(hasChanges && canResetForm)}
          aria-label='Reset form'
          onClick={toggleResetFormConfirm}
        >
          Reset form
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

export function SaveDraftAction() {
  const { canSaveDraft, readOnly, saveDraftLabel } = useAuthoringSession()
  const { saveDraft } = useAuthoringActions()
  const { hasChanges, isSubmitting } = useAuthoringFormStatus()
  const stagedEditorOpen = Boolean(useAuthoringStagedEditor().groupEditor)
  if (readOnly || !canSaveDraft) return null

  return (
    <Button
      className={styles.lifecycleButton}
      disabled={!hasChanges || stagedEditorOpen}
      loading={isSubmitting}
      onClick={() => void saveDraft()}
      type='button'
      variant='default'
    >
      {saveDraftLabel}
    </Button>
  )
}

export function ActivateAction() {
  const { activateLabel, readOnly } = useAuthoringSession()
  const { activate } = useAuthoringActions()
  const { canFinalize, isSubmitting } = useAuthoringFormStatus()
  const stagedEditorOpen = Boolean(useAuthoringStagedEditor().groupEditor)
  if (readOnly) return null

  return (
    <Button
      className={clsx(styles.lifecycleButton, styles.activateButton)}
      disabled={!canFinalize || stagedEditorOpen}
      loading={isSubmitting}
      onClick={() => void activate()}
      type='button'
    >
      {activateLabel ?? 'Activate'}
    </Button>
  )
}

export function PreviewToggleAction() {
  const { isWideDesktop, previewContent, previewOpen, togglePreview } = useAuthoringLayout()
  if (isWideDesktop || !previewContent) return null

  const label = previewOpen ? 'Hide preview' : 'Show preview'

  return (
    <HeaderIconAction
      ariaControls='authoring-preview'
      ariaExpanded={previewOpen}
      isActive={previewOpen}
      label={label}
      onClick={togglePreview}
    >
      <Eye size={14} aria-hidden='true' />
    </HeaderIconAction>
  )
}

export function OverflowActionMenu() {
  const { canDelete, deleteLabel, isDeleting } = useAuthoringSession()
  const { deleteRecord } = useAuthoringActions()
  if (!canDelete) return null

  return (
    <Menu position='bottom-end'>
      <Menu.Target>
        <ActionIcon
          aria-label='More authoring actions'
          className={styles.headerIconButton}
          variant='transparent'
        >
          <Ellipsis size={18} aria-hidden='true' />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          color='red'
          disabled={isDeleting}
          leftSection={<Trash2 size={14} aria-hidden='true' />}
          onClick={() => void deleteRecord()}
        >
          {deleteLabel}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
