import { useMemo } from 'react'
import type { ReactNode, SubmitEventHandler } from 'react'
import { Alert, Button } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useShellAuthoringChrome } from '#app/shell'
import { ContextCard } from '../components/ContextCard/ContextCard'
import * as contextStyles from '../components/ContextCard/ContextCard.css'
import { EditorHeader } from '../components/EditorHeader/EditorHeader'
import { Rail, StructureRail } from '../components/Rail/Rail'
import type { Item, ItemIcon, ItemStatus, Summary } from '../components/Rail/Rail.types'
import { useAuthoringForm } from '../components/AuthoringFormContext'
import { getVisibleAuthoringSteps } from '../hooks/useAuthoringResolvedModel'
import type { AuthoringFormStepStatus } from '../navigation/AuthoringFormStepNav'
import { AuthoringActionBar } from './AuthoringActionBar'
import * as styles from './AuthoringWorkspaceLayout.css'

export type AuthoringWorkspaceLayoutProps = {
  children: ReactNode
  preview?: ReactNode
  previewLabel?: string
  showInspector?: boolean
}

export function AuthoringWorkspaceLayout({
  children,
  preview,
  previewLabel = 'Preview',
  showInspector = true
}: AuthoringWorkspaceLayoutProps) {
  const authoring = useAuthoringForm()
  const [navigationOpen, { close: closeNavigation, toggle: toggleNavigation }] = useDisclosure(true)
  const title = authoring.activeStepLabel ?? authoring.subjectKindLabel
  const subjectLabel = readReactNodeText(authoring.subjectLabel) ?? authoring.subjectKindLabel
  const status = getAuthoringStatus(authoring.mode, authoring.isDraft || authoring.hasActiveDraft)
  const visibleSteps = useMemo(() => getVisibleAuthoringSteps(authoring.resolvedModel), [authoring.resolvedModel])
  const activeStepId = authoring.activeStepId ?? visibleSteps[0]?.id
  const activeStep = visibleSteps.find((step) => step.id === activeStepId)
  const activeSections = useMemo(() => (
    activeStep?.sections.filter((section) => section.nodes.some((node) => node.visible)) ?? []
  ), [activeStep])
  const stepStatuses = useMemo<Partial<Record<string, AuthoringFormStepStatus>> | undefined>(() => {
    if (!activeStepId || !authoring.hasStepChanges) return undefined
    return { [activeStepId]: 'dirty' }
  }, [activeStepId, authoring.hasStepChanges])
  const railItems = useMemo(() => toRailItems({
    activeSections,
    activeStepId,
    steps: visibleSteps,
    stepStatuses
  }), [activeSections, activeStepId, stepStatuses, visibleSteps])
  const summaries = useMemo(() => toSummaries(visibleSteps.length, authoring.hasChanges), [
    authoring.hasChanges,
    visibleSteps.length
  ])
  const desktopRail = useMemo(() => (
    <Rail
      items={railItems}
      subtitle={subjectLabel}
      summaries={summaries}
    />
  ), [
    railItems,
    subjectLabel,
    summaries
  ])
  const mobileRail = useMemo(() => (
    <StructureRail
      items={railItems}
      onClose={closeNavigation}
      subtitle={subjectLabel}
      summaries={summaries}
    />
  ), [
    closeNavigation,
    railItems,
    subjectLabel,
    summaries
  ])
  const chrome = useMemo(() => ({
    crumbs: [
      { label: `${authoring.subjectKindLabel}s` },
      { label: subjectLabel }
    ],
    desktopRail,
    isNavigationOpen: navigationOpen,
    mobileRail,
    onNavigationClose: closeNavigation,
    onNavigationToggle: toggleNavigation,
    statusLabel: status.label
  }), [
    authoring.subjectKindLabel,
    closeNavigation,
    desktopRail,
    mobileRail,
    navigationOpen,
    status.label,
    subjectLabel,
    toggleNavigation
  ])
  useShellAuthoringChrome(chrome)
  const inspector = preview ?? (showInspector ? <AuthoringWorkspaceInspector previewLabel={previewLabel} /> : null)

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()
    void authoring.activate()
  }

  return (
    <form className={styles.shell} noValidate onSubmit={handleSubmit}>
      <main className={styles.canvas} data-testid='authoring-form-content'>
        <div className={styles.content}>
          <div className={styles.contentStack}>
            <EditorHeader
              path={[
                { label: subjectLabel },
                ...(activeStep?.label ? [{ label: activeStep.label }] : [])
              ]}
              tagLabel={authoring.subjectKindLabel}
              title={title}
            />
            {authoring.readOnly
              ? (
                  <Alert className={styles.alertSlot} color='orange'>
                    {`This ${authoring.subjectKindLabel.toLowerCase()} is locked for direct editing. Duplicate it to make your own draft.`}
                  </Alert>
                )
              : null}
            {children}
          </div>
          {inspector ? <aside className={styles.previewRail} aria-label={previewLabel}>{inspector}</aside> : null}
        </div>
      </main>
      <AuthoringActionBar
        className={styles.actionBarSlot}
        padding='padded'
        surface='header'
        start={authoring.canGoBack
          ? (
              <Button type='button' variant='default' onClick={() => void authoring.goToPreviousStep()}>
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
                    <Button type='submit' disabled={!authoring.canSubmit} loading={authoring.isSubmitting}>
                      {authoring.activateLabel}
                    </Button>
                  )
            )
          : (
              <Button type='button' disabled={!authoring.canGoNext} onClick={() => void authoring.goToNextStep()}>
                Next
              </Button>
            )}
      />
    </form>
  )
}

function AuthoringWorkspaceInspector({ previewLabel }: { previewLabel: string }) {
  const authoring = useAuthoringForm()
  const currentStep = authoring.activeStepLabel ?? 'Current step'
  const subject = readReactNodeText(authoring.subjectLabel) ?? authoring.subjectKindLabel
  const visibleFields = useMemo(() => {
    const step = authoring.resolvedModel?.steps.find((candidate) => candidate.id === authoring.activeStepId)
    return step?.sections
      .flatMap((section) => section.nodes)
      .filter((node) => node.visible)
      .slice(0, 4)
      .map((node) => ({
        id: node.id,
        label: node.label,
        required: node.required
      })) ?? []
  }, [authoring.activeStepId, authoring.resolvedModel])

  return (
    <>
      <ContextCard title='Outcome context' titleId='authoring-outcome-context' header={{ divider: true }}>
        <ul className={contextStyles.ruleList}>
          {visibleFields.map((field) => (
            <li className={contextStyles.ruleItem} key={field.id}>
              <span>{field.label}</span>
              <strong>{field.required ? 'Required' : 'Optional'}</strong>
            </li>
          ))}
          {visibleFields.length === 0
            ? (
                <li className={contextStyles.ruleItem}>
                  <span>Step</span>
                  <strong>{currentStep}</strong>
                </li>
              )
            : null}
        </ul>
      </ContextCard>
      <ContextCard title={previewLabel} titleId='authoring-preview' header={{ emphasized: true }}>
        <p className={contextStyles.previewText}>
          <strong>{subject}</strong>
          {' '}
          is being shaped through
          {' '}
          <strong>{currentStep}</strong>
          .
        </p>
      </ContextCard>
    </>
  )
}

function toRailItems({
  activeSections,
  activeStepId,
  steps,
  stepStatuses
}: {
  activeSections: readonly { id: string, label: string }[]
  activeStepId?: string
  steps: readonly { id: string, label: string, description?: string }[]
  stepStatuses?: Partial<Record<string, AuthoringFormStepStatus>>
}): readonly Item[] {
  return steps.map((step) => {
    const isActive = step.id === activeStepId
    const status = toRailStatus(stepStatuses?.[step.id])

    return {
      children: isActive
        ? activeSections.map((section) => ({
            icon: 'book' as ItemIcon,
            id: `${step.id}-${section.id}`,
            isActive: false,
            label: section.label,
            level: 1,
            status: 'empty' as ItemStatus,
            tone: 'muted'
          }))
        : undefined,
      description: step.description,
      expanded: isActive,
      icon: iconForStep(step.label),
      id: step.id,
      isActive,
      label: step.label,
      level: 0,
      status
    }
  })
}

function toRailStatus(status: AuthoringFormStepStatus | undefined): ItemStatus {
  switch (status) {
    case 'dirty':
      return 'dirty'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'valid':
    case undefined:
      return 'complete'
  }
}

function iconForStep(label: string): ItemIcon {
  const key = label.toLowerCase()
  if (key.includes('mechanic') || key.includes('rule')) return 'gear'
  if (key.includes('damage') || key.includes('ancestry')) return 'flame'
  if (key.includes('feature') || key.includes('option')) return 'spark'
  if (key.includes('scaling') || key.includes('level')) return 'trend'
  return 'book'
}

function toSummaries(stepCount: number, hasChanges: boolean): readonly Summary[] {
  return [
    {
      label: 'steps',
      status: 'complete',
      value: `${stepCount}/${stepCount}`
    },
    {
      label: hasChanges ? 'edited' : 'saved',
      status: hasChanges ? 'dirty' : 'complete',
      value: hasChanges ? 'Edited' : 'Saved'
    }
  ]
}

function getAuthoringStatus(mode: string, isDraft: boolean) {
  if (mode === 'create') return { label: 'New Draft' }
  if (isDraft) return { label: 'Draft' }
  return { label: 'Active' }
}

function readReactNodeText(value: ReactNode): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}
