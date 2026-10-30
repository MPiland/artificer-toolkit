import { Alert, Text } from '@mantine/core'
import { useAuthoringSession } from '../layout/AuthoringFormContext'
import {
  findAuthoringValidationTarget,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'

type AuthoringValidationAlertProps = {
  target?: AuthoringNavigationTarget
  validationTargets: readonly AuthoringNavigationTarget[]
}

export function AuthoringValidationAlert({
  target,
  validationTargets
}: AuthoringValidationAlertProps) {
  const { validationIssues } = useAuthoringSession()
  if (!target) return null

  const issues = validationIssues.filter(
    (issue) => findAuthoringValidationTarget(issue.path, validationTargets)?.id === target.id
  )
  if (issues.length === 0) return null

  return (
    <Alert color='red' title='Fix validation issues'>
      <Text size='sm'>{issues.map((issue) => issue.message).join(' ')}</Text>
    </Alert>
  )
}
