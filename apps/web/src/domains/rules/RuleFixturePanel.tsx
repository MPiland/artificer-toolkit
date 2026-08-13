import { Alert, Button, Code, Group, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { RulePackDocumentDto, SimulateRulePackResultDto } from '#app/lib/api'

export function RuleFixturePanel({
  document,
  selectedId,
  editable,
  result,
  error,
  running,
  onSelect,
  onChange,
  onAdd,
  onRemove,
  onRun
}: {
  document: RulePackDocumentDto
  selectedId: string | null
  editable: boolean
  result: SimulateRulePackResultDto | null
  error: string | null
  running: boolean
  onSelect: (id: string | null) => void
  onChange: (field: 'label' | 'modelKey' | 'input' | 'expected', value: string) => void
  onAdd: () => void
  onRemove: () => void
  onRun: () => void
}) {
  const fixture = document.fixtures.find((item) => item.id === selectedId)
  const [inputText, setInputText] = useState('')
  const [expectedText, setExpectedText] = useState('')

  useEffect(() => {
    setInputText(fixture ? JSON.stringify(fixture.input, null, 2) : '')
    setExpectedText(fixture ? JSON.stringify(fixture.expected, null, 2) : '')
  }, [fixture])

  return (
    <Stack>
      <Stack gap='xs'>
        <Select
          data={document.fixtures.map((item) => ({ value: item.id, label: item.label }))}
          label='Fixture'
          value={selectedId}
          onChange={onSelect}
        />
        <Group gap='xs' grow>
          <Button disabled={!editable} onClick={onAdd}>
            Add fixture
          </Button>
          {fixture ? (
            <Button color='red' disabled={!editable} variant='default' onClick={onRemove}>
              Remove
            </Button>
          ) : null}
        </Group>
      </Stack>
      {fixture ? (
        <>
          <TextInput
            disabled={!editable}
            label='Label'
            value={fixture.label}
            onChange={(event) => onChange('label', event.currentTarget.value)}
          />
          <Select
            data={Object.keys(document.models)}
            disabled={!editable}
            label='Model'
            value={fixture.modelKey}
            onChange={(value) => value && onChange('modelKey', value)}
          />
          <Textarea
            autosize
            disabled={!editable}
            label='Input JSON'
            maxRows={12}
            minRows={5}
            value={inputText}
            onBlur={() => onChange('input', inputText)}
            onChange={(event) => setInputText(event.currentTarget.value)}
          />
          <Textarea
            autosize
            disabled={!editable}
            label='Expected JSON'
            maxRows={12}
            minRows={5}
            value={expectedText}
            onBlur={() => onChange('expected', expectedText)}
            onChange={(event) => setExpectedText(event.currentTarget.value)}
          />
          <Button loading={running} onClick={onRun}>
            Run fixture
          </Button>
        </>
      ) : null}
      {error ? <Alert color='red'>{error}</Alert> : null}
      {result ? (
        <Alert color='teal' title='Simulation result'>
          <Code block>{JSON.stringify(result, null, 2)}</Code>
        </Alert>
      ) : null}
    </Stack>
  )
}
