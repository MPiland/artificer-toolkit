import { Button, FileButton, Group } from '@mantine/core'
import type { RulePackDocumentDto } from '#app/lib/api'

export function RuleImportExportActions({
  document,
  disabled,
  onImport
}: {
  document: RulePackDocumentDto
  disabled: boolean
  onImport: (file: File | null) => void
}) {
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
    )
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = 'rule-pack.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Group gap='xs'>
      <FileButton accept='application/json' disabled={disabled} onChange={onImport}>
        {(props) => (
          <Button {...props} variant='default'>
            Import
          </Button>
        )}
      </FileButton>
      <Button variant='default' onClick={download}>
        Export
      </Button>
    </Group>
  )
}
