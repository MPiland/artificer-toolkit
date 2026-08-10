import { Alert, List, Text } from '@mantine/core'
import type { ImportPreviewResponseDto } from '@artificer-toolkit/schema/api/imports'

export function LibraryImportIssues({
  issues
}: {
  issues: ImportPreviewResponseDto['items'][number]['issues']
}) {
  const correctionCount = issues.filter((issue) => issue.correctionRequired).length
  const color = issues.some((issue) => issue.severity === 'ERROR')
    ? 'red'
    : issues.some((issue) => issue.severity === 'WARNING')
      ? 'yellow'
      : 'blue'

  return (
    <Alert
      color={color}
      title={correctionCount ? 'Needs review' : 'Import details'}
      variant='light'
    >
      <List size='sm'>
        {issues.map((issue, index) => (
          <List.Item key={`${issue.code}-${index}`}>
            <Text size='sm'>{issue.message}</Text>
            {issue.correctionRequired && issue.path.length ? (
              <Text c='dimmed' size='xs'>
                Source: {issue.path.join('.')}
              </Text>
            ) : null}
          </List.Item>
        ))}
      </List>
    </Alert>
  )
}
