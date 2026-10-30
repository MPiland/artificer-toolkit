import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { Button, Group, Text } from '@mantine/core'
import { useAuthoringActions, useAuthoringSession } from '../layout/AuthoringFormContext'
import * as styles from './guidedAuthoring.css'

type GuidedAuthoringFrameProps = {
  canContinue?: boolean
  children: ReactNode
  description: string
  domainLabel: string
  onAdvanced: (() => void) | undefined
  onBack?: () => void
  onNext?: () => void
  stepIndex?: number
  steps?: readonly string[]
  title: string
}

export function GuidedAuthoringFrame({
  canContinue = true,
  children,
  description,
  domainLabel,
  onAdvanced,
  onBack,
  onNext,
  stepIndex,
  steps,
  title
}: GuidedAuthoringFrameProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { cancelHref, cancelLabel } = useAuthoringSession()
  const { cancel } = useAuthoringActions()
  const hasProgress = stepIndex !== undefined && steps !== undefined

  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex, title])

  const handleCancel = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    void cancel()
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerMeta}>
          <Text className={styles.headerLabel}>Guided {domainLabel.toLowerCase()}</Text>
          {hasProgress ? (
            <Text className={styles.headerStep}>
              Step {stepIndex + 1} of {steps.length}
            </Text>
          ) : null}
        </div>
        <Button
          className={styles.headerAction}
          disabled={!onAdvanced}
          type='button'
          variant='subtle'
          onClick={onAdvanced}
        >
          Switch to advanced
        </Button>
      </header>

      {hasProgress ? (
        <nav aria-label={`Guided ${domainLabel.toLowerCase()} authoring progress`}>
          <ol
            className={styles.progress}
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((label, index) => (
              <li
                key={label}
                className={styles.progressItem}
                aria-current={index === stepIndex ? 'step' : undefined}
              >
                <span
                  className={styles.progressBar}
                  data-current={index === stepIndex ? 'true' : undefined}
                  data-complete={index < stepIndex ? 'true' : undefined}
                />
                <span className={styles.srOnly}>
                  Step {index + 1}: {label} (
                  {index < stepIndex ? 'complete' : index === stepIndex ? 'current' : 'upcoming'})
                </span>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
      </div>

      <div key={`${stepIndex ?? 'start'}:${title}`} className={styles.screen}>
        {children}
      </div>

      <div className={styles.navigation}>
        <Group gap='xs'>
          {onBack ? (
            <Button
              className={styles.navigationAction}
              type='button'
              variant='default'
              onClick={onBack}
            >
              Back
            </Button>
          ) : null}
          {cancelHref ? (
            <Button
              className={styles.navigationAction}
              color='red'
              component='a'
              href={cancelHref}
              variant='filled'
              onClick={handleCancel}
            >
              {cancelLabel}
            </Button>
          ) : null}
        </Group>
        {onNext ? (
          <Button
            className={styles.navigationAction}
            disabled={!canContinue}
            type='button'
            variant='filled'
            onClick={onNext}
          >
            Next
          </Button>
        ) : null}
      </div>
    </div>
  )
}
