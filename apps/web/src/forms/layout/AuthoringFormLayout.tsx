import { useCallback, useMemo, useState } from 'react'
import type { ReactNode, SubmitEventHandler } from 'react'
import { ActionIcon, Alert, Button, Drawer, Group, Menu, Tooltip } from '@mantine/core'
import { BookOpen, ChevronDown, ChevronRight, FileText, ListTree, MoreVertical, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useShellHeaderSupplement } from '#app/shell'
import { useAuthoringForm } from '../components/AuthoringFormContext'
import type { AuthoringFormMode } from '../components/AuthoringFormContext'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import type { AuthoringFormStepStatus } from '../navigation/AuthoringFormStepNav'
import { AuthoringActionBar } from './AuthoringActionBar'
import * as styles from './AuthoringFormLayout.css'

export type AuthoringFormLayoutProps = {
  children: ReactNode
  className?: string
  preview?: ReactNode
  previewLabel?: string
  showInspector?: boolean
}

export function AuthoringFormLayout({
  children,
  className,
  preview,
  previewLabel = 'Preview',
  showInspector = true
}: AuthoringFormLayoutProps) {
  const authoring = useAuthoringForm()
  const title = authoring.activeStepLabel ?? authoring.subjectKindLabel
  const subjectKind = authoring.subjectKindLabel.toLowerCase()
  const status = getAuthoringStatus(authoring.mode, authoring.isDraft || authoring.hasActiveDraft)
  const inspector = preview ?? (showInspector ? <AuthoringInspector statusLabel={status.label} /> : null)
  const activePreviewLabel = preview == null && showInspector ? 'Context' : previewLabel
  const hasPreview = inspector != null
  const [structureOpened, setStructureOpened] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)
  const activeStepId = authoring.activeStepId
  const goToStep = authoring.goToStep
  const subjectKindLabel = authoring.subjectKindLabel
  const visibleSteps = useMemo(() => getVisibleAuthoringSteps(authoring.resolvedModel), [authoring.resolvedModel])
  const showStepNav = visibleSteps.length > 1 && activeStepId != null
  const activeStepSections = useMemo(() => {
    const activeStep = visibleSteps.find((step) => step.id === activeStepId)
    return activeStep?.sections.filter((section) => section.nodes.some((node) => node.visible)) ?? []
  }, [activeStepId, visibleSteps])
  const showActiveSectionOutline = activeStepSections.length > 1
  const stepStatuses = useMemo<Partial<Record<string, AuthoringFormStepStatus>> | undefined>(() => {
    if (!activeStepId || !authoring.hasStepChanges) return undefined
    return { [activeStepId]: 'dirty' }
  }, [activeStepId, authoring.hasStepChanges])
  const handleStepChange = useCallback((stepId: string) => {
    goToStep(stepId)
    setStructureOpened(false)
  }, [goToStep])
  const structureNav = useMemo(() => {
    if (!showStepNav) return null

    return (
      <StructureRailTree
        activeStep={activeStepId ?? visibleSteps[0].id}
        activeStepSections={activeStepSections}
        onStepChange={handleStepChange}
        stepStatuses={stepStatuses}
        steps={visibleSteps}
        subjectKindLabel={subjectKindLabel}
      />
    )
  }, [
    activeStepId,
    activeStepSections,
    handleStepChange,
    showStepNav,
    stepStatuses,
    subjectKindLabel,
    visibleSteps
  ])
  const structureContent = useMemo(() => {
    if (!structureNav) return null

    return (
      <>
        {structureNav}
        {showActiveSectionOutline
          ? (
              <div className={styles.structureSectionList} aria-label={`${authoring.activeStepLabel} sections`}>
                {activeStepSections.map((section) => (
                  <span className={styles.structureSectionItem} key={section.id}>
                    {section.label}
                  </span>
                ))}
              </div>
            )
          : null}
      </>
    )
  }, [activeStepSections, authoring.activeStepLabel, showActiveSectionOutline, structureNav])

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
      {statusChip}
    </Group>
  ), [statusChip])
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
        ? <Alert color='orange'>{`This ${subjectKind} is locked for direct editing. Duplicate it to make your own draft.`}</Alert>
        : null}
      {showStepNav
        ? (
            <Drawer
              opened={structureOpened}
              onClose={() => setStructureOpened(false)}
              position='left'
              size='min(320px, 86vw)'
              title={`${subjectKindLabel} structure`}
            >
              <div className={styles.drawerNav}>{structureContent}</div>
            </Drawer>
          )
        : null}
      {hasPreview
        ? (
            <Drawer
              opened={previewOpened}
              onClose={() => setPreviewOpened(false)}
              position='right'
              size='min(360px, 90vw)'
              title={activePreviewLabel}
            >
              <div className={styles.drawerNav}>{inspector}</div>
            </Drawer>
          )
        : null}
      <form
        className={clsx(
          styles.shell,
          showStepNav && styles.shellWithRail,
          hasPreview && styles.shellWithPreview,
          showStepNav && hasPreview && styles.shellWithRailPreview
        )}
        noValidate
        onSubmit={handleSubmit}
      >
        {showStepNav
          ? (
              <aside className={styles.structureRail} aria-label={`${subjectKindLabel} structure`}>
                <div className={styles.structureRailHeader}>
                  <span className={styles.structureRailEyebrow}>Structure</span>
                  <span className={styles.structureRailCurrent}>{authoring.subjectLabel ?? subjectKindLabel}</span>
                </div>
                {structureContent}
              </aside>
            )
          : null}
        {showStepNav || hasPreview
          ? (
              <div className={styles.mobileStructureBar}>
                {showStepNav
                  ? (
                      <Button
                        leftSection={<ListTree size={16} />}
                        type='button'
                        variant='default'
                        onClick={() => setStructureOpened(true)}
                      >
                        Structure
                      </Button>
                    )
                  : null}
                <span className={styles.mobileStructureCurrent}>{authoring.activeStepLabel}</span>
                {hasPreview
                  ? (
                      <Button
                        type='button'
                        variant='default'
                        onClick={() => setPreviewOpened(true)}
                      >
                        {activePreviewLabel}
                      </Button>
                    )
                  : null}
              </div>
            )
          : null}
        <div className={styles.contentScroller} data-testid='authoring-form-content'>
          <div className={styles.editorHeader}>
            <div className={styles.editorHeaderMain}>
              <p className={styles.editorBreadcrumb}>
                <span>{authoring.subjectLabel ?? authoring.subjectKindLabel}</span>
                <span aria-hidden='true'>/</span>
                <span>{authoring.activeStepLabel ?? authoring.subjectKindLabel}</span>
              </p>
              <div className={styles.editorTitleRow}>
                <h2 className={styles.editorTitle}>{authoring.activeStepLabel ?? authoring.subjectKindLabel}</h2>
                <span className={styles.editorTypeChip}>{authoring.subjectKindLabel}</span>
                {statusChip}
              </div>
            </div>
          </div>
          {children}
        </div>
        {hasPreview
          ? (
              <aside className={styles.previewRail} aria-label={activePreviewLabel}>
                {inspector}
              </aside>
            )
          : null}
        <AuthoringActionBar
          className={clsx(styles.actionBarSlot, showStepNav && styles.actionBarSlotWithRail)}
          padding='padded'
          surface='header'
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
                      disabled={!authoring.hasStepChanges}
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

type StructureRailTreeProps = {
  activeStep: string
  activeStepSections: readonly { id: string, label: string }[]
  onStepChange: (stepId: string) => void
  stepStatuses?: Partial<Record<string, AuthoringFormStepStatus>>
  steps: readonly { id: string, label: string, description?: string }[]
  subjectKindLabel: string
}

function StructureRailTree({
  activeStep,
  activeStepSections,
  onStepChange,
  stepStatuses,
  steps,
  subjectKindLabel
}: StructureRailTreeProps) {
  return (
    <nav className={styles.structureTree} aria-label={`${subjectKindLabel} steps`}>
      <div className={styles.structureTreeRoot}>
        <ChevronDown size={16} className={styles.structureTreeChevron} aria-hidden='true' />
        <BookOpen size={16} className={styles.structureTreeIcon} aria-hidden='true' />
        <span className={styles.structureTreeLabel}>{subjectKindLabel}</span>
      </div>
      <ol className={styles.structureTreeList}>
        {steps.map((step) => {
          const isActive = step.id === activeStep
          const status = stepStatuses?.[step.id]

          return (
            <li className={styles.structureTreeItem} key={step.id}>
              <button
                aria-current={isActive ? 'step' : undefined}
                className={clsx(styles.structureTreeRow, isActive && styles.structureTreeRowActive)}
                onClick={() => onStepChange(step.id)}
                type='button'
              >
                {isActive && activeStepSections.length > 0
                  ? <ChevronDown size={16} className={styles.structureTreeChevron} aria-hidden='true' />
                  : <ChevronRight size={16} className={styles.structureTreeChevronMuted} aria-hidden='true' />}
                <FileText size={16} className={styles.structureTreeIcon} aria-hidden='true' />
                <span className={styles.structureTreeLabel}>{step.label}</span>
                {status
                  ? <span className={styles.structureTreeStatus} aria-label={getStructureStatusLabel(status)} />
                  : null}
              </button>
              {isActive && activeStepSections.length > 0
                ? (
                    <ol className={styles.structureTreeChildren}>
                      {activeStepSections.map((section) => (
                        <li className={styles.structureTreeChild} key={section.id}>
                          <span className={styles.structureTreeChildRail} aria-hidden='true' />
                          <span className={styles.structureTreeChildLabel}>{section.label}</span>
                        </li>
                      ))}
                    </ol>
                  )
                : null}
            </li>
          )
        })}
      </ol>
      <div className={styles.structureTreeFooter}>
        <span className={styles.structureTreeFooterSignal}>
          <span className={styles.structureTreeFooterDot} aria-hidden='true' />
          0 Critical
        </span>
        <span className={styles.structureTreeFooterSignal}>
          <span className={styles.structureTreeFooterDotMuted} aria-hidden='true' />
          0 Warn
        </span>
      </div>
    </nav>
  )
}

function getStructureStatusLabel(status: AuthoringFormStepStatus) {
  switch (status) {
    case 'dirty':
      return 'Changed'
    case 'warning':
      return 'Needs review'
    case 'error':
      return 'Has errors'
    case 'valid':
      return 'Valid'
  }
}

function AuthoringInspector({ statusLabel }: { statusLabel: string }) {
  const authoring = useAuthoringForm()
  const currentStep = authoring.activeStepLabel ?? 'Current step'
  const subject = authoring.subjectLabel ?? authoring.subjectKindLabel
  const visibleFields = useMemo(() => {
    const step = authoring.resolvedModel?.steps.find((candidate) => candidate.id === authoring.activeStepId)
    return step?.sections
      .flatMap((section) => section.nodes)
      .filter((node) => node.visible)
      .slice(0, 6)
      .map((node) => ({
        id: node.id,
        label: node.label,
        required: node.required
      })) ?? []
  }, [authoring.activeStepId, authoring.resolvedModel])
  const requiredFieldCount = visibleFields.filter((field) => field.required).length
  const contextRows = visibleFields.length > 0
    ? visibleFields.slice(0, 4).map((field) => ({
        id: field.id,
        label: field.label,
        value: field.required ? 'Required' : 'Optional'
      }))
    : [
        { id: 'status', label: 'Status', value: statusLabel },
        { id: 'step', label: 'Step', value: currentStep }
      ]
  const changeState = authoring.hasStepChanges
    ? 'This step has unsaved changes.'
    : 'No unsaved changes on this step.'
  const draftState = authoring.hasChanges
    ? 'Draft changes are ready to save.'
    : 'The draft matches the saved version.'

  return (
    <div className={styles.inspectorStack}>
      <section className={styles.inspectorSection} aria-label='Outcome context'>
        <div className={styles.inspectorSectionHeader}>Outcome Context</div>
        <dl className={styles.inspectorMetaList}>
          {contextRows.map((row) => (
            <div className={styles.inspectorMetaRow} key={row.id}>
              <dt className={styles.inspectorMetaTerm}>{row.label}</dt>
              <dd className={styles.inspectorMetaValue}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <span className={styles.inspectorContextSummary}>
          {visibleFields.length}
          {' '}
          visible fields,
          {' '}
          {requiredFieldCount}
          {' '}
          required
        </span>
      </section>
      <section className={styles.inspectorSection} aria-label='Rule preview'>
        <div className={styles.inspectorSectionHeader}>Rule Preview</div>
        <p className={styles.inspectorPreviewText}>
          <strong>{subject}</strong>
          {' '}
          is being shaped through the
          {' '}
          <strong>{currentStep}</strong>
          {' '}
          step.
        </p>
        <div className={styles.inspectorSignalList}>
          <span className={authoring.hasStepChanges ? styles.inspectorSignalActive : styles.inspectorSignal}>
            {changeState}
          </span>
          <span className={authoring.hasChanges ? styles.inspectorSignalActive : styles.inspectorSignal}>
            {draftState}
          </span>
        </div>
      </section>
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
