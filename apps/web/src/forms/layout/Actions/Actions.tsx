import type { ReactNode } from 'react'
import { ActionIcon, Button, Menu, Tooltip } from '@mantine/core'
import { ChevronLeft, Eye, PanelLeft, RotateCcw, Save, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useAuthoringForm } from '../AuthoringFormContext'
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

export function HeaderIconAction({
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
  const { stepsNavigationOpen, toggleStepsNavigation } = useAuthoringLayout()
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
  const { readOnly, canResetStep, canResetForm, hasStepChanges, hasChanges, resetStep } =
    useAuthoringForm()
  const { toggleResetFormConfirm } = useAuthoringLayout()
  if (readOnly || !canResetStep) return null

  return (
    <Menu>
      <Menu.Target>
        <ActionIcon aria-label='Reset actions' className={styles.headerIconButton}>
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
  const { readOnly, canSaveDraft, hasChanges, saveDraftLabel, saveDraft, isSubmitting } =
    useAuthoringForm()
  if (readOnly || !canSaveDraft) return null

  return (
    <HeaderIconAction
      disabled={!hasChanges}
      label={saveDraftLabel}
      loading={isSubmitting}
      onClick={() => void saveDraft()}
    >
      <Save size={14} aria-hidden='true' />
    </HeaderIconAction>
  )
}

export function PreviewToggleAction() {
  const { previewContent, previewOpen, togglePreview } = useAuthoringLayout()
  if (!previewContent) return null

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

export function AuthoringBackAction() {
  const { isFirstStep, goToPreviousStep, cancel, cancelLabel } = useAuthoringForm()
  if (!isFirstStep) {
    return (
      <Button
        leftSection={<ChevronLeft size={16} aria-hidden='true' />}
        type='button'
        variant='default'
        onClick={() => void goToPreviousStep()}
      >
        Back
      </Button>
    )
  }

  return (
    <Button type='button' variant='default' onClick={() => void cancel()}>
      {cancelLabel}
    </Button>
  )
}

export function DeleteRecordAction() {
  const { canDelete, isDeleting, deleteRecord, deleteLabel } = useAuthoringForm()
  if (!canDelete) return null

  return (
    <HeaderIconAction
      isDestructive
      label={deleteLabel}
      loading={isDeleting}
      onClick={() => void deleteRecord()}
    >
      <Trash2 size={14} aria-hidden='true' />
    </HeaderIconAction>
  )
}
