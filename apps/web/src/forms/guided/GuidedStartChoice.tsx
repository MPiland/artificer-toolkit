import { useMemo, useState } from 'react'
import { AppSelect } from '#ui/primitives/Select'
import { Badge, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { Copy, Sparkles } from 'lucide-react'
import { useAuthoringForm } from '../layout/AuthoringFormContext'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import { GuidedAuthoringFrame } from './GuidedAuthoringFrame'
import {
  getGuidedCopySourceQueryKey,
  getGuidedCopySources,
  toGuidedCopySources,
  type GuidedCopySource
} from './guidedCopySources'
import * as styles from './guidedAuthoring.css'

type GuidedStartChoiceProps = {
  domain: AuthoredFormDomain
  domainLabel: string
  onAdvanced: () => void
  onFresh: () => void
}

export function GuidedStartChoice({
  domain,
  domainLabel,
  onAdvanced,
  onFresh
}: GuidedStartChoiceProps) {
  const [existingMode, setExistingMode] = useState(false)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const { copySource } = useAuthoringForm()
  const sources = useQuery({
    enabled: existingMode,
    queryFn: () => getGuidedCopySources(domain),
    queryKey: getGuidedCopySourceQueryKey(domain),
    select: toGuidedCopySources
  })
  const selectedSource = useMemo(
    () => sources.data?.find((source) => source.id === selectedSourceId),
    [selectedSourceId, sources.data]
  )
  const sourceOptions = useMemo(
    () =>
      (sources.data ?? []).map((source) => ({
        label: source.label,
        value: source.id
      })),
    [sources.data]
  )

  const chooseExisting = () => {
    setExistingMode(true)
    setSelectedSourceId(null)
  }

  const createCopy = async () => {
    if (!selectedSourceId) return

    setCopying(true)
    try {
      await copySource(selectedSourceId)
    } finally {
      setCopying(false)
    }
  }

  return (
    <GuidedAuthoringFrame
      description={`Create a new ${domainLabel.toLowerCase()}, or use something proven as your starting point.`}
      domainLabel={domainLabel}
      onAdvanced={onAdvanced}
      title='How do you want to begin?'
    >
      <div className={styles.choiceGrid}>
        <Button
          className={styles.choiceButton}
          justify='flex-start'
          leftSection={<Sparkles aria-hidden size={24} className={styles.choiceIcon} />}
          type='button'
          variant='default'
          onClick={onFresh}
        >
          <span className={styles.choiceCopy}>
            <span className={styles.choiceTitle}>Start from scratch</span>
            <span className={styles.choiceDescription}>
              Begin with simple defaults and build it one step at a time.
            </span>
          </span>
        </Button>
        <Button
          className={styles.choiceButton}
          data-selected={existingMode ? 'true' : undefined}
          justify='flex-start'
          leftSection={<Copy aria-hidden size={24} className={styles.choiceIcon} />}
          type='button'
          variant='default'
          onClick={chooseExisting}
        >
          <span className={styles.choiceCopy}>
            <Group gap='xs' wrap='wrap'>
              <span className={styles.choiceTitle}>
                Use an existing {domainLabel.toLowerCase()}
              </span>
              {domain === 'class' ? <Badge size='xs'>Recommended</Badge> : null}
            </Group>
            <span className={styles.choiceDescription}>
              Search active content and create an owned Copy draft to customize.
            </span>
          </span>
        </Button>
      </div>

      {existingMode ? (
        <section className={styles.copyPanel} aria-label={`Use an existing ${domainLabel.toLowerCase()}`}>
          <Stack gap='md'>
            <Text size='sm' c='dimmed'>
              Choose a source first. Nothing is copied until you confirm with Create copy.
            </Text>
            <AppSelect
              autoFocus
              disabled={sources.isLoading || sources.isError}
              label={`Search ${domainLabel.toLowerCase()}s`}
              placeholder='Search by name'
              data={sourceOptions}
              value={selectedSourceId}
              searchable
              onChange={setSelectedSourceId}
            />
            {sources.isLoading ? (
              <Group justify='center' py='xl'>
                <Loader size='sm' />
              </Group>
            ) : null}
            {sources.isError ? (
              <Text c='red' size='sm'>
                Could not load active content. Try again.
              </Text>
            ) : null}
            {!sources.isLoading && !sources.isError && sourceOptions.length === 0 ? (
              <Text c='dimmed' size='sm'>
                No copyable {domainLabel.toLowerCase()}s are available.
              </Text>
            ) : null}
            {selectedSource ? <CopySourceSummary domain={domain} source={selectedSource} /> : null}
            <Group justify='flex-end'>
              <Button
                className={styles.navigationAction}
                disabled={!selectedSourceId || copying}
                loading={copying}
                type='button'
                onClick={() => void createCopy()}
              >
                Create copy
              </Button>
            </Group>
          </Stack>
        </section>
      ) : null}
    </GuidedAuthoringFrame>
  )
}

function CopySourceSummary({
  domain,
  source
}: {
  domain: AuthoredFormDomain
  source: GuidedCopySource
}) {
  const metadata = formatMetadata(domain, source)

  return (
    <div className={styles.sourceSummary} aria-live='polite'>
      <Group justify='space-between' align='flex-start' gap='sm'>
        <Text fw={600}>{source.label}</Text>
        <Badge color={source.source === 'SRD' ? 'teal' : 'gray'} variant='light'>
          {source.source}
        </Badge>
      </Group>
      <Text size='sm' c='dimmed'>
        {source.description}
      </Text>
      {metadata.length ? (
        <Text size='sm' c='dimmed'>
          {metadata.join(' · ')}
        </Text>
      ) : null}
    </div>
  )
}

function formatMetadata(
  domain: AuthoredFormDomain,
  source: GuidedCopySource
): string[] {
  if (domain === 'spell') {
    const level = source.level === 0 ? 'Cantrip' : source.level ? `Level ${source.level}` : undefined
    return [level, source.castingTime].filter((value): value is string => Boolean(value))
  }
  if (domain === 'class' || domain === 'race' || domain === 'equipment' || domain === 'creature' || domain === 'vehicle') {
    return source.category ? [humanizeCode(source.category)] : []
  }
  return []
}

function humanizeCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
