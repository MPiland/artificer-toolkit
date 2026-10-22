import {
  Button,
  Card,
  FileInput,
  Group,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea
} from '@mantine/core'
import { IMPORT_MAX_ENTRIES, type ImportSourceDto } from '@artificer-toolkit/schema/api/imports'
import type { SystemListItemDto } from '@artificer-toolkit/schema/api/systems'
import { hasImportInput } from './libraryImport.model'

const sourceOptions: { value: ImportSourceDto; label: string; description: string }[] = [
  {
    value: 'DND_BEYOND',
    label: 'D&D Beyond',
    description: 'Paste character-sheet links. No account details or API links needed.'
  },
  {
    value: 'FOUNDRY_DND5E',
    label: 'Foundry VTT',
    description: 'Choose exported dnd5e Actor JSON files.'
  },
  {
    value: 'ARTIFICER_JSON',
    label: 'Artificer JSON',
    description: 'Choose JSON files exported from your Artificer Library.'
  }
]

export function LibraryImportInput({
  files,
  inputSummary,
  links,
  loading,
  source,
  systems,
  gameSystemId,
  primaryRulesCatalogueId,
  onFilesChange,
  onLinksChange,
  onPreview,
  onGameSystemChange,
  onPrimaryRulesCatalogueChange,
  onSourceChange
}: {
  files: File[]
  inputSummary: string
  links: string
  loading: boolean
  source: ImportSourceDto
  systems: SystemListItemDto[]
  gameSystemId: string
  primaryRulesCatalogueId: string
  onFilesChange: (files: File[]) => void
  onLinksChange: (links: string) => void
  onPreview: () => void
  onGameSystemChange: (systemId: string) => void
  onPrimaryRulesCatalogueChange: (catalogueId: string) => void
  onSourceChange: (source: ImportSourceDto) => void
}) {
  const selectedSystem = systems.find((system) => system.id === gameSystemId)
  const bindingRequired = source !== 'ARTIFICER_JSON'
  return (
    <Stack gap='lg'>
      <Radio.Group
        label='Choose a source'
        value={source}
        onChange={(value) => {
          const nextSource = sourceOptions.find((option) => option.value === value)?.value
          if (nextSource) onSourceChange(nextSource)
        }}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {sourceOptions.map((option) => (
            <Card key={option.value} padding='md' withBorder>
              <Radio value={option.value} label={option.label} />
              <Text c='dimmed' mt='xs' size='sm'>
                {option.description}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Radio.Group>

      {bindingRequired ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            data={systems.map((system) => ({ value: system.id, label: system.label }))}
            label='Game System'
            onChange={(value) => onGameSystemChange(value ?? '')}
            required
            searchable
            value={gameSystemId || null}
          />
          <Select
            data={(selectedSystem?.rulesCatalogues ?? []).map((catalogue) => ({
              value: catalogue.id,
              label: catalogue.label
            }))}
            disabled={!selectedSystem}
            label='Rules Catalogue'
            onChange={(value) => onPrimaryRulesCatalogueChange(value ?? '')}
            required
            value={primaryRulesCatalogueId || null}
          />
        </SimpleGrid>
      ) : null}

      {source === 'DND_BEYOND' ? (
        <Textarea
          autosize
          description='One normal character-sheet link per line. Publicly accessible sheets work best.'
          label='Character-sheet links'
          minRows={5}
          placeholder='https://www.dndbeyond.com/characters/12345678'
          value={links}
          onChange={(event) => onLinksChange(event.currentTarget.value)}
        />
      ) : (
        <FileInput
          clearable
          accept='application/json,.json'
          description={`Up to ${IMPORT_MAX_ENTRIES} JSON files, 10 MiB each, 25 MiB total.`}
          label={source === 'FOUNDRY_DND5E' ? 'Foundry Actor exports' : 'Artificer exports'}
          multiple
          placeholder='Choose JSON files'
          value={files}
          onChange={(nextFiles) => onFilesChange(nextFiles ?? [])}
        />
      )}

      <Group justify='space-between'>
        <Text c='dimmed' size='sm'>
          {inputSummary}
        </Text>
        <Button
          disabled={
            !hasImportInput(source, links, files) ||
            (bindingRequired && (!gameSystemId || !primaryRulesCatalogueId))
          }
          loading={loading}
          onClick={onPreview}
        >
          Preview import
        </Button>
      </Group>
    </Stack>
  )
}
