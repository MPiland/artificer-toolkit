import type { ReactNode, SubmitEventHandler } from 'react'
import { Alert, Button, Group, Text } from '@mantine/core'
import clsx from 'clsx'
import { useAuthoringForm } from '../components/AuthoringFormContext'
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
  const eyebrow = authoring.mode !== 'create' ? authoring.subjectLabel : undefined
  const subjectKind = authoring.subjectKindLabel.toLowerCase()

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    event.stopPropagation()
    void authoring.activate()
  }

  return (
    <div className={clsx(styles.root, className)}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {eyebrow ? <Text className={styles.eyebrow}>{eyebrow}</Text> : null}
        </div>
        {authoring.readOnly && authoring.canCopy
          ? <Button type='button' onClick={() => void authoring.copy()}>{authoring.copyLabel}</Button>
          : null}
      </header>
      {authoring.readOnly
        ? <Alert color='cyan'>{`This ${subjectKind} is locked for direct editing. Duplicate it to make your own draft.`}</Alert>
        : null}
      {authoring.hasActiveDraft
        ? <Alert color='blue'>{`You are editing a draft. The active ${subjectKind} stays unchanged until you activate these changes.`}</Alert>
        : null}
      <form className={styles.shell} onSubmit={handleSubmit}>
        {children}
        <div className={styles.footer}>
          <Button type='button' variant='default' onClick={() => void authoring.cancel()}>
            {authoring.cancelLabel}
          </Button>
          <Group justify='flex-end'>
            <Button
              type='button'
              variant='default'
              disabled={!authoring.canGoBack}
              onClick={() => void authoring.goToPreviousStep()}
            >
              Back
            </Button>
            {!authoring.readOnly && authoring.canSaveDraft
              ? (
                  <Button type='button' variant='default' onClick={() => void authoring.saveDraft()}>
                    {authoring.saveDraftLabel}
                  </Button>
                )
              : null}
            {authoring.isLastStep
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
          </Group>
        </div>
      </form>
    </div>
  )
}
