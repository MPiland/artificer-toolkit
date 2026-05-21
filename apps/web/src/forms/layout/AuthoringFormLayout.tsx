import { useMemo } from 'react'
import type { ReactNode, SubmitEventHandler } from 'react'
import { ActionIcon, Alert, Button, Group, Menu, Tooltip } from '@mantine/core'
import { MoreVertical, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useShellHeaderSupplement } from '#app/shell'
import { useAuthoringForm } from '../components/AuthoringFormContext'
import type { AuthoringFormMode } from '../components/AuthoringFormContext'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import { AuthoringFormStepNav } from '../navigation/AuthoringFormStepNav'
import { AuthoringActionBar } from './AuthoringActionBar'
import * as styles from './AuthoringFormLayout.css'

export type AuthoringFormLayoutProps = {
  children: ReactNode
  className?: string
}

export function AuthoringFormLayout({
  children,
  className
}: AuthoringFormLayoutProps) {
  const authoring = useAuthoringForm()
  const title = authoring.activeStepLabel ?? authoring.subjectKindLabel
  const subjectKind = authoring.subjectKindLabel.toLowerCase()
  const status = getAuthoringStatus(authoring.mode, authoring.isDraft || authoring.hasActiveDraft)
  const activeStepId = authoring.activeStepId
  const goToStep = authoring.goToStep
  const subjectKindLabel = authoring.subjectKindLabel
  const visibleSteps = useMemo(() => getVisibleAuthoringSteps(authoring.resolvedModel), [authoring.resolvedModel])
  const showStepNav = visibleSteps.length > 1 && activeStepId != null
  const headerStepNav = useMemo(() => {
    if (!showStepNav) return null

    return (
      <AuthoringFormStepNav
        activeStep={activeStepId ?? visibleSteps[0].id}
        ariaLabel={`${subjectKindLabel} steps`}
        onStepChange={(stepId) => goToStep(stepId)}
        steps={visibleSteps}
      />
    )
  }, [
    activeStepId,
    goToStep,
    showStepNav,
    subjectKindLabel,
    visibleSteps
  ])

  const statusChip = useMemo(() => (
    <span
      aria-label={`Current ${subjectKind} status: ${status.label}`}
      className={clsx(styles.statusChip, status.className)}
    >
      {status.label}
    </span>
  ), [status.className, status.label, subjectKind])
  const shellHeaderContent = useMemo(() => (
    <Group gap='sm' align='center' wrap='nowrap'>
      {headerStepNav}
      {statusChip}
    </Group>
  ), [headerStepNav, statusChip])
  const recordActions = useMemo(() => (
    <Group gap='xs'>
      {authoring.readOnly && authoring.canCopy
        ? <Button type='button' onClick={() => void authoring.copy()}>{authoring.copyLabel}</Button>
        : null}
      {!authoring.readOnly && authoring.canDelete
        ? (
            <Menu position='bottom-end' width={220}>
              <Menu.Target>
                <ActionIcon aria-label='Form actions' loading={authoring.isDeleting} variant='default'>
                  <MoreVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color='red'
                  leftSection={<Trash2 size={16} />}
                  onClick={() => void authoring.deleteRecord()}
                >
                  {authoring.deleteLabel}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )
        : null}
    </Group>
  ), [
    authoring.canCopy,
    authoring.canDelete,
    authoring.copy,
    authoring.copyLabel,
    authoring.deleteLabel,
    authoring.deleteRecord,
    authoring.isDeleting,
    authoring.readOnly
  ])
  const hasShellHeader = useShellHeaderSupplement(shellHeaderContent, {
    actions: recordActions,
    hideBreadcrumbLeaf: true
  })

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()
    void authoring.activate()
  }

  return (
    <div className={clsx(styles.root, className)}>
      {!hasShellHeader
        ? (
            <header className={styles.header}>
              <div className={styles.headerContent}>
                <Group gap='xs' align='center'>
                  <h1 className={styles.title}>{title}</h1>
                  {statusChip}
                </Group>
              </div>
              <Group gap='xs'>
                {authoring.readOnly && authoring.canCopy
                  ? <Button type='button' onClick={() => void authoring.copy()}>{authoring.copyLabel}</Button>
                  : null}
                {!authoring.readOnly && authoring.canDelete
                  ? (
                      <Tooltip label={authoring.deleteLabel}>
                        <ActionIcon
                          aria-label={authoring.deleteLabel}
                          className={styles.dangerIconButton}
                          loading={authoring.isDeleting}
                          type='button'
                          variant='default'
                          onClick={() => void authoring.deleteRecord()}
                        >
                          <Trash2 size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )
                  : null}
              </Group>
            </header>
          )
        : null}
      {authoring.readOnly
        ? <Alert color='cyan'>{`This ${subjectKind} is locked for direct editing. Duplicate it to make your own draft.`}</Alert>
        : null}
      <form className={styles.shell} onSubmit={handleSubmit}>
        <div className={styles.contentScroller} data-testid='authoring-form-content'>
          {children}
        </div>
        <AuthoringActionBar
          start={authoring.canGoBack
            ? (
                <Button
                  type='button'
                  variant='default'
                  onClick={() => void authoring.goToPreviousStep()}
                >
                  Back
                </Button>
              )
            : (
                <Button type='button' variant='default' onClick={() => void authoring.cancel()}>
                  {authoring.cancelLabel}
                </Button>
              )}
          center={(
            <>
              {!authoring.readOnly && authoring.canResetStep
                ? (
                    <Button
                      disabled={!authoring.hasChanges}
                      type='button'
                      variant='default'
                      onClick={() => void authoring.resetStep()}
                    >
                      {authoring.resetStepLabel}
                    </Button>
                  )
                : null}
              {!authoring.readOnly && authoring.canSaveDraft
                ? (
                    <Button
                      disabled={!authoring.hasChanges}
                      type='button'
                      variant={authoring.hasChanges ? 'filled' : 'default'}
                      onClick={() => void authoring.saveDraft()}
                    >
                      {authoring.saveDraftLabel}
                    </Button>
                  )
                : null}
            </>
          )}
          end={authoring.isLastStep
            ? (
                authoring.readOnly
                  ? null
                  : (
                      <Button
                        type='submit'
                        disabled={!authoring.canSubmit}
                        loading={authoring.isSubmitting}
                      >
                        {authoring.activateLabel}
                      </Button>
                    )
              )
            : (
                <Button
                  type='button'
                  disabled={!authoring.canGoNext}
                  onClick={() => void authoring.goToNextStep()}
                >
                  Next
                </Button>
              )}
        />
      </form>
    </div>
  )
}

function getAuthoringStatus(mode: AuthoringFormMode, isDraft: boolean) {
  if (mode === 'create') {
    return { label: 'New Draft', className: styles.statusChipDraft }
  }

  if (isDraft) {
    return { label: 'Draft', className: styles.statusChipDraft }
  }

  return { label: 'Active', className: styles.statusChipActive }
}
