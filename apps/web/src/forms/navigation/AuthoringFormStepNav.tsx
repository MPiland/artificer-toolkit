import { UnstyledButton } from '@mantine/core'
import clsx from 'clsx'
import * as styles from './AuthoringFormStepNav.css'

export interface AuthoringFormStep<TStep extends string> {
  id: TStep
  label: string
  description?: string
}

export interface AuthoringFormStepNavProps<TStep extends string> {
  activeStep: TStep
  ariaLabel?: string
  onStepChange: (step: TStep) => void
  stepStatuses?: Partial<Record<TStep, AuthoringFormStepStatus>>
  steps: readonly AuthoringFormStep<TStep>[]
  variant?: 'inline' | 'rail'
}

export type AuthoringFormStepStatus = 'valid' | 'dirty' | 'warning' | 'error'

export function AuthoringFormStepNav<TStep extends string>({
  activeStep,
  ariaLabel = 'Form sections',
  onStepChange,
  stepStatuses,
  steps,
  variant = 'inline'
}: AuthoringFormStepNavProps<TStep>) {
  const isRail = variant === 'rail'

  return (
    <nav className={clsx(styles.nav, isRail && styles.navRail)} aria-label={ariaLabel}>
      <ol className={clsx(styles.list, isRail && styles.listRail)}>
        {steps.map((step) => {
          const isActive = step.id === activeStep
          const status = stepStatuses?.[step.id] ?? 'valid'
          const hasError = status === 'error'

          return (
            <li className={clsx(styles.item, isRail && styles.itemRail)} key={step.id}>
              <UnstyledButton
                aria-invalid={hasError || undefined}
                aria-label={getStepAriaLabel(step, status)}
                aria-current={isActive ? 'step' : undefined}
                className={clsx(
                  styles.stepButton,
                  isRail && styles.stepButtonRail,
                  isActive && styles.stepButtonActive,
                  isRail && isActive && styles.stepButtonRailActive,
                  hasError && styles.stepButtonError
                )}
                onClick={() => onStepChange(step.id)}
                type='button'
              >
                <span className={styles.stepButtonLabel}>
                  {isRail
                    ? <span className={clsx(styles.stepMarker, isActive && styles.stepMarkerActive)} aria-hidden='true' />
                    : null}
                  <span className={styles.stepLabel}>{step.label}</span>
                  {isRail && step.description
                    ? <span className={styles.stepDescription}>{step.description}</span>
                    : null}
                </span>
                {status !== 'valid'
                  ? (
                      <span className={styles.statusMeta}>
                        <span className={clsx(styles.statusDot, styles[getStepStatusClassName(status)])} aria-hidden='true' />
                        {isRail ? <span className={styles.statusLabel}>{getStepStatusLabel(status)}</span> : null}
                      </span>
                    )
                  : null}
              </UnstyledButton>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function getStepAriaLabel<TStep extends string>(
  step: AuthoringFormStep<TStep>,
  status: AuthoringFormStepStatus
) {
  const description = step.description ? `: ${step.description}` : ''
  const statusCopy = status === 'valid' ? '' : `, ${getStepStatusLabel(status).toLowerCase()}`

  return `${step.label}${description}${statusCopy}`
}

function getStepStatusLabel(status: Exclude<AuthoringFormStepStatus, 'valid'>) {
  switch (status) {
    case 'dirty':
      return 'Changed'
    case 'warning':
      return 'Needs review'
    case 'error':
      return 'Has errors'
  }
}

function getStepStatusClassName(status: Exclude<AuthoringFormStepStatus, 'valid'>) {
  switch (status) {
    case 'dirty':
      return 'statusDotDirty'
    case 'warning':
      return 'statusDotWarning'
    case 'error':
      return 'statusDotError'
  }
}
