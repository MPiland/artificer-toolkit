import { useMemo, useState } from 'react'
import { AppSelect } from '#ui/primitives/Select'
import { Badge, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { Copy, Sparkles } from 'lucide-react'
import { useContentCatalogue } from '#app/data/contentSnapshots/useContentCatalogue'
import { getSpell } from '#app/data/spells/queries'
import { useAuthoringActions } from '../layout/AuthoringFormContext'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import { GuidedAuthoringFrame } from './GuidedAuthoringFrame'
import { toGuidedCopySources, type GuidedCopySource } from './guidedCopySources'
import * as styles from './guidedAuthoring.css'

type GuidedStartChoiceProps = {
  domain: AuthoredFormDomain
  domainLabel: string
  systemId?: string
  onAdvanced: (() => void) | undefined
  onFresh: () => void
}

const DOMAIN_NOUNS: Record<AuthoredFormDomain, { singular: string; plural: string }> = {
  background: { singular: 'background', plural: 'backgrounds' },
  class: { singular: 'class', plural: 'classes' },
  creature: { singular: 'creature', plural: 'creatures' },
  equipment: { singular: 'item', plural: 'items' },
  feat: { singular: 'feat', plural: 'feats' },
  race: { singular: 'race', plural: 'races' },
  spell: { singular: 'spell', plural: 'spells' },
  vehicle: { singular: 'vehicle', plural: 'vehicles' }
}

export function GuidedStartChoice({
  domain,
  domainLabel,
  systemId,
  onAdvanced,
  onFresh
}: GuidedStartChoiceProps) {
  const nouns = DOMAIN_NOUNS[domain]
  const [existingMode, setExistingMode] = useState(false)
  const chooseExisting = () => {
    setExistingMode(true)
  }

  return (
    <GuidedAuthoringFrame
      description={`Create a new ${nouns.singular}, or use something proven as your starting point.`}
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
              <span className={styles.choiceTitle}>Use an existing {nouns.singular}</span>
              {domain === 'class' ? <Badge size='xs'>Recommended</Badge> : null}
            </Group>
            <span className={styles.choiceDescription}>
              Choose an existing {nouns.singular} to copy and edit.
            </span>
          </span>
        </Button>
      </div>

      {existingMode ? (
        <CatchBoundary
          getResetKey={() => `${domain}:${systemId ?? 'missing-system'}`}
          errorComponent={GuidedCopySourceUnavailable}
        >
          <GuidedNativeCopySourceLoader
            domain={domain}
            key={systemId ?? 'missing-system'}
            systemId={systemId}
          />
        </CatchBoundary>
      ) : null}
    </GuidedAuthoringFrame>
  )
}

function GuidedNativeCopySourceLoader({
  domain,
  systemId
}: {
  domain: 'background' | 'class' | 'feat' | 'creature' | 'equipment' | 'race' | 'spell' | 'vehicle'
  systemId?: string
}) {
  const catalogue = useContentCatalogue(
    domain === 'background'
      ? 'BACKGROUND'
      : domain === 'class'
        ? 'CLASS'
        : domain === 'feat'
          ? 'FEAT'
          : domain === 'creature'
            ? 'CREATURE'
            : domain === 'equipment'
              ? 'EQUIPMENT'
              : domain === 'race'
                ? 'RACE'
                : domain === 'spell'
                  ? 'SPELL'
                  : 'VEHICLE',
    { enabled: Boolean(systemId), systemId }
  )

  if (!systemId) return <GuidedCopySourceSystemRequired domain={domain} />

  return (
    <GuidedCopySourcePicker
      domain={domain}
      error={catalogue.isError}
      loading={catalogue.isPending}
      sources={toGuidedCopySources(catalogue.items ?? [])}
    />
  )
}

function GuidedCopySourceUnavailable() {
  return (
    <section className={styles.copyPanel} aria-label='Use an existing source'>
      <Text c='red' size='sm'>
        Sources are unavailable. Try again.
      </Text>
    </section>
  )
}

function GuidedCopySourceSystemRequired({
  domain
}: {
  domain: 'background' | 'class' | 'feat' | 'creature' | 'equipment' | 'race' | 'spell' | 'vehicle'
}) {
  return (
    <section
      className={styles.copyPanel}
      aria-label={`Use an existing ${DOMAIN_NOUNS[domain].singular}`}
    >
      <Text c='red' size='sm'>
        A System is required before {DOMAIN_NOUNS[domain].plural} can be copied.
      </Text>
    </section>
  )
}

function GuidedCopySourcePicker({
  domain,
  error,
  loading,
  sources
}: {
  domain: AuthoredFormDomain
  error: boolean
  loading: boolean
  sources: readonly GuidedCopySource[]
}) {
  const nouns = DOMAIN_NOUNS[domain]
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const { copySource } = useAuthoringActions()
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId),
    [selectedSourceId, sources]
  )
  const sourceOptions = useMemo(
    () => sources.map((source) => ({ label: source.label, value: source.id })),
    [sources]
  )

  const createCopy = async () => {
    if (!selectedSource) return

    setCopying(true)
    try {
      await copySource(selectedSource.id)
    } finally {
      setCopying(false)
    }
  }

  return (
    <section className={styles.copyPanel} aria-label={`Use an existing ${nouns.singular}`}>
      <Stack gap='md'>
        <Text size='sm' c='dimmed'>
          Choose a source first. Nothing is copied until you confirm with Create copy.
        </Text>
        <AppSelect
          autoFocus
          disabled={loading || error}
          label={`Search ${nouns.plural}`}
          placeholder='Search by name'
          data={sourceOptions}
          value={selectedSourceId}
          searchable
          onChange={setSelectedSourceId}
        />
        {loading ? (
          <Group justify='center' py='xl'>
            <Loader size='sm' />
          </Group>
        ) : null}
        {error ? (
          <Text c='red' size='sm'>
            Could not load active content. Try again.
          </Text>
        ) : null}
        {!loading && !error && sourceOptions.length === 0 ? (
          <Text c='dimmed' size='sm'>
            No copyable {nouns.plural} are available.
          </Text>
        ) : null}
        {selectedSource ? <CopySourceSummary domain={domain} source={selectedSource} /> : null}
        <Group justify='flex-end'>
          <Button
            className={styles.navigationAction}
            disabled={!selectedSource || loading || error || copying}
            loading={copying}
            type='button'
            onClick={() => void createCopy()}
          >
            Create copy
          </Button>
        </Group>
      </Stack>
    </section>
  )
}

function GuidedSpellCopySourceMetadata({ sourceId }: { sourceId: string }) {
  const detail = useQuery(getSpell(sourceId))
  const spell = detail.data?.item

  if (detail.isPending) {
    return (
      <Text size='sm' c='dimmed'>
        Loading spell details…
      </Text>
    )
  }

  if (detail.isError || !spell) {
    return (
      <Text size='sm' c='dimmed'>
        Spell details are unavailable. You can still create a copy.
      </Text>
    )
  }

  const level = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`
  const castingTime = `${spell.castingTime.amount} ${spell.castingTime.unit.toLowerCase()}`

  return (
    <Text size='sm' c='dimmed'>
      {level} · {castingTime}
    </Text>
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
      {domain === 'spell' ? <GuidedSpellCopySourceMetadata sourceId={source.id} /> : null}
    </div>
  )
}

function formatMetadata(domain: AuthoredFormDomain, source: GuidedCopySource): string[] {
  if (domain === 'spell') {
    const level =
      source.level === 0 ? 'Cantrip' : source.level ? `Level ${source.level}` : undefined
    return [level, source.castingTime].filter((value): value is string => Boolean(value))
  }
  if (
    domain === 'class' ||
    domain === 'race' ||
    domain === 'equipment' ||
    domain === 'creature' ||
    domain === 'vehicle'
  ) {
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
