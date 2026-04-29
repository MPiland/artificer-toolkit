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
  steps: readonly AuthoredFormStep<TStep>[]
}

export function AuthoredFormStepNav<TStep extends string>({
  activeStep,
  ariaLabel = 'Form sections',
  onStepChange,
  steps
}: AuthoredFormStepNavProps<TStep>) {
  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <ol className={styles.list}>
        {steps.map((step) => {
          const isActive = step.id === activeStep

          return (
            <li className={styles.item} key={step.id}>
              <UnstyledButton
                aria-label={step.description ? `${step.label}: ${step.description}` : step.label}
                aria-current={isActive ? 'step' : undefined}
                className={clsx(styles.stepButton, isActive && styles.stepButtonActive)}
                onClick={() => onStepChange(step.id)}
                type='button'
              >
                {step.label}
              </UnstyledButton>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
