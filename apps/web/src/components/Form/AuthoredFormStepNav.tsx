import { UnstyledButton } from '@mantine/core'
import clsx from 'clsx'
import * as styles from './AuthoredFormStepNav.css'

export interface AuthoredFormStep<TStep extends string> {
  id: TStep
  label: string
  description?: string
}

export interface AuthoredFormStepNavProps<TStep extends string> {
  activeStep: TStep
  ariaLabel?: string
  onStepChange: (step: TStep) => void
  stepStatuses?: Partial<Record<TStep, 'valid' | 'dirty' | 'error'>>
  steps: readonly AuthoredFormStep<TStep>[]
}

export function AuthoredFormStepNav<TStep extends string>({
  activeStep,
  ariaLabel = 'Form sections',
  onStepChange,
  stepStatuses,
  steps
}: AuthoredFormStepNavProps<TStep>) {
  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <ol className={styles.list}>
        {steps.map((step) => {
          const isActive = step.id === activeStep
          const status = stepStatuses?.[step.id] ?? 'valid'
          const hasError = status === 'error'

          return (
            <li className={styles.item} key={step.id}>
              <UnstyledButton
                aria-invalid={hasError || undefined}
                aria-label={getStepAriaLabel(step, status)}
                aria-current={isActive ? 'step' : undefined}
                className={clsx(styles.stepButton, isActive && styles.stepButtonActive, hasError && styles.stepButtonError)}
                onClick={() => onStepChange(step.id)}
                type='button'
              >
                {step.label}
                {hasError ? <span className={styles.errorDot} aria-hidden='true' /> : null}
              </UnstyledButton>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function getStepAriaLabel<TStep extends string>(
  step: AuthoredFormStep<TStep>,
  status: 'valid' | 'dirty' | 'error'
) {
  const description = step.description ? `: ${step.description}` : ''
  const statusCopy = status === 'error' ? ', has errors' : ''

  return `${step.label}${description}${statusCopy}`
}
