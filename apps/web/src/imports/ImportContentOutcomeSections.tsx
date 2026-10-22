import { Accordion, Button, Group, List, SegmentedControl, Stack, Text } from '@mantine/core'
import { findOption } from '../forms/utils/valueGuards'
import {
  getDefaultImportCustomContentChoice,
  getImportCustomContentKey,
  type ImportCustomContentChoice,
  type ImportExistingMatch,
  type ImportNotImportedContent,
  type ImportRelatedContent
} from './importCustomContentChoiceUtils'

export function ImportContentOutcomeSections({
  choices,
  entryId,
  existingMatches,
  items,
  notImported,
  onChoiceChange,
  onSetAll
}: {
  choices: Record<string, ImportCustomContentChoice>
  entryId: string
  existingMatches: ImportExistingMatch[]
  items: ImportRelatedContent[]
  notImported: ImportNotImportedContent[]
  onChoiceChange: (key: string, choice: ImportCustomContentChoice) => void
  onSetAll: (keys: string[], choice: ImportCustomContentChoice) => void
}) {
  const readyItems = items.filter((item) => item.activationEligible)
  const draftItems = items.filter((item) => !item.activationEligible)
  const readyKeys = readyItems.map((item) => getImportCustomContentKey(entryId, item))
  const existingMatchCount = existingMatches.reduce((total, item) => total + item.count, 0)
  const notImportedCount = notImported.reduce((total, item) => total + item.count, 0)

  return (
    <Accordion multiple variant='contained'>
      {existingMatches.length ? (
        <Accordion.Item value='existing-matches'>
          <Accordion.Control>Existing Library matches ({existingMatchCount})</Accordion.Control>
          <Accordion.Panel>
            <Stack gap='sm'>
              <Text c='dimmed' size='sm'>
                These source items will use existing Library content.
              </Text>
              <List size='sm'>
                {existingMatches.map((match) => (
                  <List.Item
                    key={`${match.subjectKind}:${match.sourceLabel}:${match.matchedLabel}`}
                  >
                    {match.sourceLabel} → {match.matchedLabel}
                    {match.count > 1 ? ` × ${match.count}` : ''}
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ) : null}

      {readyItems.length ? (
        <Accordion.Item value='ready-to-activate'>
          <Accordion.Control>Ready to activate ({readyItems.length})</Accordion.Control>
          <Accordion.Panel>
            <Stack gap='md'>
              <Text c='dimmed' size='sm'>
                These items contain everything required. Choose Active or Draft for each.
              </Text>
              <Group gap='xs'>
                <Text size='sm'>Set all:</Text>
                <Button size='xs' variant='default' onClick={() => onSetAll(readyKeys, 'ACTIVE')}>
                  Active
                </Button>
                <Button size='xs' variant='default' onClick={() => onSetAll(readyKeys, 'DRAFT')}>
                  Draft
                </Button>
              </Group>
              {readyItems.map((item) => {
                const key = getImportCustomContentKey(entryId, item)
                const choice = choices[key] ?? getDefaultImportCustomContentChoice(item)
                return (
                  <Group key={key} align='center' justify='space-between' wrap='wrap'>
                    <Text size='sm'>{item.label}</Text>
                    <SegmentedControl
                      aria-label={`Import ${item.label} as`}
                      data={[
                        { label: 'Active', value: 'ACTIVE' },
                        { label: 'Draft', value: 'DRAFT' }
                      ]}
                      size='xs'
                      value={choice}
                      onChange={(value) => {
                        const nextChoice = findOption(['ACTIVE', 'DRAFT'], value)
                        if (nextChoice) onChoiceChange(key, nextChoice)
                      }}
                    />
                  </Group>
                )
              })}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ) : null}

      {draftItems.length ? (
        <Accordion.Item value='drafts-required'>
          <Accordion.Control>Drafts required ({draftItems.length})</Accordion.Control>
          <Accordion.Panel>
            <Stack gap='sm'>
              <Text c='dimmed' size='sm'>
                These items are missing details required for activation and will be imported as
                drafts.
              </Text>
              <List size='sm'>
                {draftItems.map((item) => (
                  <List.Item key={`${item.subjectKind}:${item.externalId}`}>{item.label}</List.Item>
                ))}
              </List>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ) : null}

      {notImported.length ? (
        <Accordion.Item value='not-imported'>
          <Accordion.Control>Not imported ({notImportedCount})</Accordion.Control>
          <Accordion.Panel>
            <Stack gap='sm'>
              <Text c='dimmed' size='sm'>
                No matches were found and there wasn’t enough data to import the following:
              </Text>
              <List size='sm'>
                {notImported.map((item) => (
                  <List.Item key={`${item.subjectKind}:${item.label}`}>
                    {item.label}
                    {item.count > 1 ? ` × ${item.count}` : ''}
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      ) : null}
    </Accordion>
  )
}
