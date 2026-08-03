import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { type AuthoredDraftDto, type SpellResponseDto } from '@artificer-toolkit/schema/api/content'
import { type SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
import {
  AuthoredDetailLayout,
  AuthoredDetailPillList,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  formatEnumLabel,
  formatNumber,
  formatReferenceLabel,
  resolveAuthoredDetailState,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { SpellDetailReferenceData } from '#app/data/spells/referenceData'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'

type SpellEffect = NonNullable<SpellAuthoredDto['effects']>[number]
type SpellPath = SpellEffect['paths'][number]
type SpellDuration = {
  durationKind: string
  amount?: number
}
type SpellOutcome = {
  effectKind: string
  damageTypeId?: string
  conditionId?: string
}
type SpellResultBlock = {
  duration?: SpellDuration
  outcomes: SpellOutcome[]
}
type SpellReferenceOption = SpellDetailReferenceData['damageTypes'][number]

const standardDamageLabels = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder'
]

export function SpellDetailPage({
  draft,
  references,
  response,
  spellId,
  view
}: {
  draft: AuthoredDraftDto | null
  references: SpellDetailReferenceData
  response: SpellResponseDto
  spellId: string
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: spellAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.spells.deleteActive,
    discard: api.content.spells.discardDraft,
    detailSubjectQueryKey: queryKeys.content.spells.detailRoot(spellId),
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft(spellId),
    duplicate: api.content.spells.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: spellId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildSpellRouteParams(subject.publicId, subject.label),
        to: '/spells/$spellPublicId/$spellSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/spells' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This spell draft cannot be previewed. Delete it to return to the spell list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: spellId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'spell draft'
              })
            }
          >
            Delete
          </Button>
        </Stack>
        {actions.deleteConfirmation}
      </>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That spell could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const spellParams = buildSpellRouteParams(
    draft?.publicId ?? response?.publicId ?? spellId,
    item.label
  )
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({ to: '/spells/$spellPublicId/$spellSlug/edit', params: spellParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({ to: '/spells/$spellPublicId/$spellSlug/edit', params: spellParams })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/spells/$spellPublicId/$spellSlug',
              params: spellParams,
              search: { view: 'draft' }
            })
        }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? {
          label: 'Duplicate',
          tone: 'secondary',
          disabled: actions.isDuplicating,
          loading: actions.isDuplicating,
          onClick: () => void actions.duplicateToDraft()
        }
      : null,
    detailState.permissions.canDelete
      ? {
          label: 'Delete',
          tone: 'danger',
          disabled: actions.isDeleting,
          loading: actions.isDeleting,
          onClick: () =>
            actions.deleteContent({
              id: spellId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    { label: 'Create New', tone: 'quiet', onClick: () => navigate({ to: '/spells/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        afterFacts={
          <AuthoredDetailPillList
            label='Available For'
            items={getSpellClassLabels(item, references)}
          />
        }
        facts={getSpellFacts(item, references)}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Spell',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/spells/$spellPublicId/$spellSlug', params: spellParams }),
          onViewDraft: () =>
            navigate({
              to: '/spells/$spellPublicId/$spellSlug',
              params: spellParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getSpellSections(item)}
        showSectionNav={false}
        status={buildDetailStatusLabels({
          draft: detailState.draft,
          mode: detailState.mode,
          provenance: detailState.provenance,
          status: item.status
        })}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
  )
}

function getSpellFacts(
  spell: SpellAuthoredDto,
  references: SpellDetailReferenceData
): AuthoredDetailFact[] {
  return [
    { label: 'Level', value: formatSpellLevel(spell.level) },
    { label: 'Casting Time', value: formatSpellCastingTime(spell) },
    { label: 'Range/Area', value: formatSpellRange(spell) },
    { label: 'Components', value: formatSpellComponents(spell) },
    { label: 'Duration', value: formatSpellDuration(spell) },
    {
      label: 'School',
      value: formatReferenceLabel(
        spell.magicSchoolId,
        'Magic school selected',
        references.magicSchools
      )
    },
    { label: 'Attack/Save', value: formatSpellAttackSave(spell) },
    { label: 'Damage/Effect', value: formatSpellDamageEffect(spell, references) }
  ]
}

function getSpellClassLabels(
  spell: SpellAuthoredDto,
  references: SpellDetailReferenceData
): string[] {
  return spell.classIds.map(
    (classId) =>
      references.classes.find((option) => option.value === classId)?.label ?? 'Unknown class'
  )
}

function getSpellSections(spell: SpellAuthoredDto): AuthoredDetailSectionModel[] {
  const sections: AuthoredDetailSectionModel[] = [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={spell.description} />
    }
  ]

  if (spell.materialDescription) {
    sections.push({
      id: 'material-components',
      title: 'Material Components',
      content: <AuthoredDetailProse html={spell.materialDescription} />
    })
  }

  return sections
}

function formatSpellLevel(level: number): string {
  if (level === 0) {
    return 'Cantrip'
  }

  const mod100 = level % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : level % 10 === 1
        ? 'st'
        : level % 10 === 2
          ? 'nd'
          : level % 10 === 3
            ? 'rd'
            : 'th'

  return `${formatNumber(level)}${suffix}`
}

function formatSpellCastingTime(spell: SpellAuthoredDto): string {
  const amount = spell.castingTime.amount
  const unit =
    spell.castingTime.unit === 'ROUND' && amount === 1
      ? 'Action'
      : formatEnumLabel(spell.castingTime.unit)

  return `${formatNumber(amount)} ${amount === 1 ? unit : pluralizeUnit(unit)}`
}

function formatSpellRange(spell: SpellAuthoredDto): string {
  const range = spell.effects?.[0]?.invocation.range

  if (!range) {
    return 'Defined by spell text'
  }

  if (range.rangeKind !== 'DISTANCE') {
    return formatEnumLabel(range.rangeKind)
  }

  const unit = formatMeasurementUnit(range.unit, range.amount)

  return `${formatNumber(range.amount)} ${unit}`
}

function formatSpellComponents(spell: SpellAuthoredDto): string {
  const components = spell.components?.map((component) => {
    if (component === 'VERBAL') {
      return 'V'
    }

    if (component === 'SOMATIC') {
      return 'S'
    }

    if (component === 'MATERIAL') {
      return 'M'
    }

    return formatEnumLabel(component)
  })

  if (!components?.length) {
    return 'None'
  }

  return `${components.join(', ')}${spell.materialDescription ? ' *' : ''}`
}

function formatSpellDuration(spell: SpellAuthoredDto): string {
  const durations = collectResultBlocks(spell)
    .map((block) => block.duration)
    .filter((duration): duration is NonNullable<SpellResultBlock['duration']> => Boolean(duration))
  const uniqueDurations = [...new Set(durations.map(formatDuration))]
  const duration =
    uniqueDurations.length === 0
      ? 'Instantaneous'
      : uniqueDurations.length === 1
        ? uniqueDurations[0]
        : 'Varies'

  if (spell.attributes?.includes('CONCENTRATION') && duration !== 'Instantaneous') {
    return `Concentration, up to ${lowercaseFirst(duration)}`
  }

  return duration
}

function formatSpellAttackSave(spell: SpellAuthoredDto): string {
  const invocation = spell.effects?.[0]?.invocation

  if (!invocation) {
    return 'None'
  }

  if ('savingThrow' in invocation) {
    return `${formatEnumLabel(invocation.savingThrow.ability)} save`
  }

  if (invocation.triggerCode === 'SPELL_ATTACK') {
    return invocation.range.rangeKind === 'TOUCH' ? 'Melee' : 'Ranged'
  }

  if (
    invocation.triggerCode === 'MELEE_WEAPON_ATTACK' ||
    invocation.triggerCode === 'UNARMED_ATTACK'
  ) {
    return 'Melee'
  }

  if (invocation.triggerCode === 'RANGED_WEAPON_ATTACK') {
    return 'Ranged'
  }

  return 'None'
}

function formatSpellDamageEffect(
  spell: SpellAuthoredDto,
  references: SpellDetailReferenceData
): string {
  const outcomes = collectResultBlocks(spell).flatMap((block) => block.outcomes)
  const damageLabels = labelsForOutcomeIds(
    outcomes.flatMap((outcome) =>
      outcome.effectKind === 'DAMAGE' && outcome.damageTypeId ? [outcome.damageTypeId] : []
    ),
    references.damageTypes
  )
  const inferredDamageLabels = damageLabels.length
    ? []
    : inferDamageLabelsFromDescription(spell.description, references.damageTypes)
  const conditionLabels = labelsForOutcomeIds(
    outcomes.flatMap((outcome) =>
      outcome.effectKind === 'CONDITION' && outcome.conditionId ? [outcome.conditionId] : []
    ),
    references.conditionTypes
  )
  const labels = [...damageLabels, ...inferredDamageLabels, ...conditionLabels]

  if (labels.length > 0) {
    return [...new Set(labels)].join(', ')
  }

  if (outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')) {
    return 'Damage'
  }

  if (outcomes.some((outcome) => outcome.effectKind === 'HEAL')) {
    return 'Healing'
  }

  return 'Utility'
}

function collectResultBlocks(spell: SpellAuthoredDto): SpellResultBlock[] {
  return (spell.effects ?? []).flatMap((effect) => effect.paths.flatMap(collectPathResultBlocks))
}

function collectPathResultBlocks(path: SpellPath): SpellResultBlock[] {
  if ('resultBlock' in path) {
    return collectResultBlock(path.resultBlock)
  }

  if ('options' in path && Array.isArray(path.options)) {
    return path.options.flatMap((option) =>
      isRecord(option) ? collectResultBlock(option.resultBlock) : []
    )
  }

  if ('rows' in path && Array.isArray(path.rows)) {
    return path.rows.flatMap((row) =>
      row.resolutionKind === 'RESULT' ? collectResultBlock(row.resultBlock) : []
    )
  }

  return []
}

function collectResultBlock(value: unknown): SpellResultBlock[] {
  if (!isRecord(value) || !Array.isArray(value.outcomes)) {
    return []
  }

  return [
    {
      duration: readDuration(value.duration),
      outcomes: value.outcomes.flatMap(readOutcome)
    }
  ]
}

function readOutcome(value: unknown): SpellOutcome[] {
  if (!isRecord(value) || typeof value.effectKind !== 'string') {
    return []
  }

  return [
    {
      conditionId: typeof value.conditionId === 'string' ? value.conditionId : undefined,
      damageTypeId: typeof value.damageTypeId === 'string' ? value.damageTypeId : undefined,
      effectKind: value.effectKind
    }
  ]
}

function readDuration(value: unknown): SpellDuration | undefined {
  if (!isRecord(value) || typeof value.durationKind !== 'string') {
    return undefined
  }

  return {
    amount: typeof value.amount === 'number' ? value.amount : undefined,
    durationKind: value.durationKind
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function labelsForOutcomeIds(ids: string[], options: SpellReferenceOption[]): string[] {
  return ids.flatMap((id) => {
    const label = options.find((option) => option.value === id)?.label

    return label ? [label] : []
  })
}

function inferDamageLabelsFromDescription(
  description: string,
  options: SpellReferenceOption[]
): string[] {
  const text = stripHtml(description).toLowerCase()
  const optionLabels = options.map((option) => option.label)
  const labels = optionLabels.filter((label) => text.includes(`${label.toLowerCase()} damage`))

  return labels.length > 0
    ? labels
    : standardDamageLabels.filter((label) => text.includes(`${label.toLowerCase()} damage`))
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ')
}

function formatDuration(duration: NonNullable<SpellResultBlock['duration']>): string {
  if (duration.durationKind === 'INSTANTANEOUS') {
    return 'Instantaneous'
  }

  if (duration.durationKind === 'UNTIL_DISPELLED') {
    return 'Until dispelled'
  }

  if (duration.amount === undefined) {
    return formatEnumLabel(duration.durationKind)
  }

  return `${formatNumber(duration.amount)} ${formatMeasurementUnit(duration.durationKind, duration.amount)}`
}

function formatMeasurementUnit(unit: string, amount: number): string {
  const label = formatEnumLabel(unit).toLowerCase()

  return amount === 1 && label.endsWith('s') ? label.slice(0, -1) : label
}

function pluralizeUnit(unit: string): string {
  return unit.endsWith('s') ? unit : `${unit}s`
}

function lowercaseFirst(value: string): string {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`
}
