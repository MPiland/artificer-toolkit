import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { v4 as uuidv4 } from 'uuid'
import { produce } from 'immer'
import { useDebouncedValue } from '@mantine/hooks'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Textarea,
  Title
} from '@mantine/core'
import {
  ABILITY_CODE,
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CHARACTER_ABILITY_GENERATION_METHOD,
  CharacterStartingEquipmentSource,
  HITPOINT_CALCULATION_METHOD_CODE,
  RACE_CATEGORY_CODE,
  type AbilityCode,
  type AuthoredRecordStatus,
  type CharacterAuthored,
  type CharacterFeatureAcquisitionRecord,
  type ClassAuthored,
  type ResolvedRace,
  type StartingEquipmentAuthored
} from '@artificer-toolkit/shared'

import { Route } from '#routes/_authed/characters/$action/$_characterId'
import { useSystemPref } from '#hooks'
import {
  usePreviewCharacterBuilderSave,
  useResolveCharacterBuilder,
  useUpsertCharacterBuilder
} from '../../../data/characters/mutations'
import { useGetCharacterBuilder, useGetCharacterDraft } from '../../../data/characters/queries'

const abilityLabels: Record<AbilityCode, string> = {
  [ABILITY_CODE.STRENGTH]: 'Strength',
  [ABILITY_CODE.DEXTERITY]: 'Dexterity',
  [ABILITY_CODE.CONSTITUTION]: 'Constitution',
  [ABILITY_CODE.INTELLIGENCE]: 'Intelligence',
  [ABILITY_CODE.WISDOM]: 'Wisdom',
  [ABILITY_CODE.CHARISMA]: 'Charisma',
  [ABILITY_CODE.SPELLCASTING]: 'Spellcasting'
}

const abilityOrder: AbilityCode[] = [
  ABILITY_CODE.STRENGTH,
  ABILITY_CODE.DEXTERITY,
  ABILITY_CODE.CONSTITUTION,
  ABILITY_CODE.INTELLIGENCE,
  ABILITY_CODE.WISDOM,
  ABILITY_CODE.CHARISMA
]

const advancementOptions = [
  { value: ADVANCEMENT_METHOD_CODE.MILESTONE, label: 'Milestone' },
  { value: ADVANCEMENT_METHOD_CODE.EXPERIENCE, label: 'Experience' }
]

const abilityMethodOptions = [
  { value: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY, label: 'Standard Array' },
  { value: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY, label: 'Point Buy' },
  { value: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED, label: 'Manual / Rolled' }
]

const standardArrayOptions = ['8', '10', '12', '13', '14', '15'].map((value) => ({ value, label: value }))
const pointBuyOptions = ['8', '9', '10', '11', '12', '13', '14', '15'].map((value) => ({ value, label: value }))

const hitPointMethodOptions = [
  { value: HITPOINT_CALCULATION_METHOD_CODE.FIXED, label: 'Fixed' },
  { value: HITPOINT_CALCULATION_METHOD_CODE.MANUAL, label: 'Manual' }
]

const characterBuilderSections = [
  { id: 'HOME', label: 'Home', description: 'Identity' },
  { id: 'SPECIES', label: 'Species', description: 'Race & ancestry' },
  { id: 'CLASSES', label: 'Classes', description: 'Progression' },
  { id: 'BACKGROUND', label: 'Background', description: 'Profile' },
  { id: 'ABILITIES', label: 'Abilities & HP', description: 'Scores' },
  { id: 'EQUIPMENT', label: 'Equipment', description: 'Starting gear' },
  { id: 'SELECTIONS', label: 'Selections', description: 'Outstanding choices' },
  { id: 'REVIEW', label: 'Review', description: 'Finalize' }
] as const

type CharacterBuilderSectionId = (typeof characterBuilderSections)[number]['id']
type DirtySectionMap = Partial<Record<CharacterBuilderSectionId, boolean>>
type CharacterBuilderMode = 'create' | 'edit'

interface CharacterBuilderSavePreview {
  predictedStatus: AuthoredRecordStatus
  downgradesStatus: boolean
  removedAncestrySelections: { id: string, label: string }[]
  removedFeatureAcquisitions: { id: string, label: string }[]
  removedSpellSelections: { id: string, label: string }[]
  removedResourceGrants: { id: string, label: string }[]
  clearedStartingEquipmentSources: CharacterStartingEquipmentSource[]
  summaryLines: string[]
  destructive: boolean
}

interface PendingSaveRequest {
  sectionId: CharacterBuilderSectionId
  payloadCharacter: CharacterAuthored
  stagedSnapshot: CharacterAuthored
  dirtySnapshot: DirtySectionMap
  saveAll: boolean
  goNext?: boolean
  targetStatus?: AuthoredRecordStatus
  preview: CharacterBuilderSavePreview
}

const sectionInvalidations: Record<CharacterBuilderSectionId, CharacterBuilderSectionId[]> = {
  HOME: [],
  SPECIES: ['SELECTIONS'],
  CLASSES: ['EQUIPMENT', 'SELECTIONS'],
  BACKGROUND: ['EQUIPMENT', 'SELECTIONS'],
  ABILITIES: [],
  EQUIPMENT: [],
  SELECTIONS: [],
  REVIEW: []
}

function summarizeOptionItems(
  option: StartingEquipmentAuthored['sets'][number]['groups'][number]['options'][number],
  equipmentLabels: Record<string, string>
): string {
  return option.items.map((item) => {
    if (item.startingEquipmentKind === 'CURRENCY') {
      return item.currencies.map((currency) => `${currency.amount} ${currency.currencyId}`).join(', ')
    }

    if (item.authoringModeKind === 'SELECTED') {
      return item.equipmentIds.map((equipmentId) => equipmentLabels[equipmentId] ?? equipmentId).join(' / ')
    }

    return item.category ?? item.id
  }).join(' | ')
}

function getBaseClassOptions(classes: ClassAuthored[]) {
  return classes
    .filter((record) => record.category === 'BASE')
    .map((record) => ({ value: record.id, label: record.label }))
}

function getSubclassOptions(classes: ClassAuthored[], classId?: string) {
  if (!classId) return []
  return classes
    .filter((record) => record.category === 'SUBCLASS' && record.parentClassId === classId)
    .map((record) => ({ value: record.id, label: record.label }))
}

function getRaceOptions(races: ResolvedRace[]) {
  return races
    .filter((record) => record.category === RACE_CATEGORY_CODE.BASE)
    .map((record) => ({ value: record.id, label: record.label }))
}

function getSubraceOptions(races: ResolvedRace[], raceId?: string) {
  if (!raceId) return []
  return races
    .filter((record) => record.category === RACE_CATEGORY_CODE.SUBRACE && record.parentRaceId === raceId)
    .map((record) => ({ value: record.id, label: record.label }))
}

function ensureHitPointLevels(character: CharacterAuthored): CharacterAuthored {
  const totalLevel = character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0)
  const nextLevels = [...character.intent.hitpoints.levels]

  while (nextLevels.length < totalLevel) {
    nextLevels.push({
      level: nextLevels.length + 1,
      value: 0
    })
  }

  return produce(character, (draft) => {
    draft.intent.hitpoints.levels = nextLevels
      .slice(0, totalLevel)
      .map((entry, index) => ({
        ...entry,
        level: index + 1
      }))
  })
}

function buildFeatureAcquisition(
  featureId: string,
  source: CharacterFeatureAcquisitionRecord['source']
): CharacterFeatureAcquisitionRecord {
  return {
    id: uuidv4(),
    featureId,
    source,
    timing: { kind: 'IMMEDIATE' }
  }
}

function cloneCharacter(character: CharacterAuthored): CharacterAuthored {
  return structuredClone(character)
}

function applySectionSnapshot(
  target: CharacterAuthored,
  source: CharacterAuthored,
  sectionId: CharacterBuilderSectionId
): CharacterAuthored {
  return produce(target, (draft) => {
    switch (sectionId) {
      case 'HOME':
        draft.label = source.label
        draft.description = source.description
        draft.intent.advancement = structuredClone(source.intent.advancement)
        break
      case 'SPECIES':
        draft.intent.race = structuredClone(source.intent.race)
        draft.intent.ancestrySelections = source.intent.ancestrySelections
          ? structuredClone(source.intent.ancestrySelections)
          : undefined
        break
      case 'CLASSES':
        draft.intent.classes = structuredClone(source.intent.classes)
        break
      case 'BACKGROUND':
        draft.intent.background = structuredClone(source.intent.background)
        draft.profile = structuredClone(source.profile)
        break
      case 'ABILITIES':
        draft.intent.abilities = structuredClone(source.intent.abilities)
        draft.intent.hitpoints = structuredClone(source.intent.hitpoints)
        break
      case 'EQUIPMENT':
        draft.intent.startingEquipment = source.intent.startingEquipment
          ? structuredClone(source.intent.startingEquipment)
          : undefined
        draft.state.equipment = structuredClone(source.state.equipment)
        draft.state.currency = structuredClone(source.state.currency)
        break
      case 'SELECTIONS':
        draft.intent.featureAcquisitions = structuredClone(source.intent.featureAcquisitions)
        draft.intent.spellSelections = source.intent.spellSelections
          ? structuredClone(source.intent.spellSelections)
          : undefined
        draft.intent.resourceGrants = source.intent.resourceGrants
          ? structuredClone(source.intent.resourceGrants)
          : undefined
        break
      case 'REVIEW':
        Object.assign(draft, structuredClone(source))
        break
      default:
        break
    }

    draft.status = source.status
  })
}

function mergePreservedDirtySections(
  savedCharacter: CharacterAuthored,
  stagedCharacter: CharacterAuthored,
  dirtySections: DirtySectionMap,
  savedSection: CharacterBuilderSectionId
): CharacterAuthored {
  let next = cloneCharacter(savedCharacter)
  const clearedSections = new Set<CharacterBuilderSectionId>([
    savedSection,
    ...sectionInvalidations[savedSection]
  ])

  for (const section of characterBuilderSections) {
    if (section.id === 'REVIEW') continue
    if (!dirtySections[section.id]) continue
    if (clearedSections.has(section.id)) continue
    next = applySectionSnapshot(next, stagedCharacter, section.id)
  }

  return next
}

function clearDirtySectionsAfterSave(
  dirtySections: DirtySectionMap,
  savedSection: CharacterBuilderSectionId,
  saveAll = false
): DirtySectionMap {
  if (saveAll) return {}

  const clearedSections = new Set<CharacterBuilderSectionId>([
    savedSection,
    ...sectionInvalidations[savedSection]
  ])

  const next: DirtySectionMap = {}
  for (const section of characterBuilderSections) {
    if (dirtySections[section.id] && !clearedSections.has(section.id)) {
      next[section.id] = true
    }
  }

  return next
}

function getStatusColor(status?: AuthoredRecordStatus) {
  return status === AUTHORED_RECORD_STATUS.ACTIVE ? 'green' : 'yellow'
}

function getStatusLabel(status?: AuthoredRecordStatus) {
  return status === AUTHORED_RECORD_STATUS.ACTIVE ? 'Active' : 'Draft'
}

function getSectionIndex(sectionId?: string) {
  const index = characterBuilderSections.findIndex((section) => section.id === sectionId)
  return index >= 0 ? index : 0
}

const CharacterForm = () => {
  const navigate = useNavigate()
  const { action, _characterId } = Route.useParams()
  const [systemPref] = useSystemPref()
  const effectiveId = useMemo(() => _characterId || uuidv4(), [_characterId])
  const isNew = action === 'new'
  const builderMode: CharacterBuilderMode = isNew ? 'create' : 'edit'

  const draftQuery = useGetCharacterDraft(effectiveId, systemPref, isNew && Boolean(_characterId || systemPref))
  const builderQuery = useGetCharacterBuilder(_characterId || '', !isNew && Boolean(_characterId))
  const previewMutation = usePreviewCharacterBuilderSave()
  const resolveMutation = useResolveCharacterBuilder()
  const saveMutation = useUpsertCharacterBuilder()

  const initialPayload = isNew ? draftQuery.data : builderQuery.data
  const loading = isNew ? draftQuery.isLoading : builderQuery.isLoading

  const [activeStep, setActiveStep] = useState(0)
  const [draft, setDraft] = useState<CharacterAuthored | null>(null)
  const [persistedCharacter, setPersistedCharacter] = useState<CharacterAuthored | null>(null)
  const [resolution, setResolution] = useState(initialPayload?.resolution ?? null)
  const [dirtySections, setDirtySections] = useState<DirtySectionMap>({})
  const [pendingSaveRequest, setPendingSaveRequest] = useState<PendingSaveRequest | null>(null)

  useEffect(() => {
    if (!initialPayload?.character) return

    const nextCharacter = ensureHitPointLevels(initialPayload.character)
    setDraft(nextCharacter)
    setPersistedCharacter(nextCharacter)
    setResolution(initialPayload.resolution)
    setDirtySections({})
    setPendingSaveRequest(null)
    setActiveStep(getSectionIndex(initialPayload.resolution.recommendedSectionId))
  }, [initialPayload?.character?.id, initialPayload?.resolution?.recommendedSectionId])

  const [debouncedDraft] = useDebouncedValue(draft, 250)

  useEffect(() => {
    if (!debouncedDraft) return
    resolveMutation.mutate({
      character: debouncedDraft,
      mode: builderMode
    }, {
      onSuccess: (payload) => setResolution(payload.resolution)
    })
  }, [debouncedDraft, builderMode])

  const currentSection = characterBuilderSections[activeStep] ?? characterBuilderSections[0]
  const currentSectionDirty = Boolean(dirtySections[currentSection.id])
  const unsavedSectionCount = Object.values(dirtySections).filter(Boolean).length

  const equipmentLabels = useMemo(() => {
    const records = resolution?.registry.equipment ?? []
    return Object.fromEntries(records.map((record) => [record.id, record.label]))
  }, [resolution?.registry.equipment])

  const baseRaceOptions = useMemo(
    () => getRaceOptions(resolution?.registry.races ?? []),
    [resolution?.registry.races]
  )

  const backgroundOptions = useMemo(
    () => (resolution?.registry.backgrounds ?? []).map((record) => ({ value: record.id, label: record.label })),
    [resolution?.registry.backgrounds]
  )

  const classOptions = useMemo(
    () => getBaseClassOptions(resolution?.registry.classes ?? []),
    [resolution?.registry.classes]
  )

  const baseRaces = resolution?.registry.races ?? []
  const classes = resolution?.registry.classes ?? []
  const system = resolution?.registry.system

  const selectedBaseRace = baseRaces.find((record) =>
    record.category === RACE_CATEGORY_CODE.BASE && record.id === draft?.intent.race.raceId
  )
  const selectedResolvedRace = baseRaces.find((record) => record.id === draft?.intent.race.subraceId)
    ?? selectedBaseRace

  const primaryClass = classes.find((record) => record.id === draft?.intent.classes[0]?.classId && record.category === 'BASE')
  const selectedBackground = resolution?.registry.backgrounds.find(
    (record) => record.id === draft?.intent.background.backgroundId
  )

  const markSectionDirty = (sectionId: CharacterBuilderSectionId = currentSection.id) => {
    setDirtySections((current) => current[sectionId] ? current : { ...current, [sectionId]: true })
  }

  const updateDraft = (
    recipe: (value: CharacterAuthored) => CharacterAuthored,
    sectionId: CharacterBuilderSectionId = currentSection.id
  ) => {
    markSectionDirty(sectionId)
    setDraft((current) => current ? ensureHitPointLevels(recipe(current)) : current)
  }

  const patchDraft = (
    mutator: Parameters<typeof produce<CharacterAuthored>>[1],
    sectionId: CharacterBuilderSectionId = currentSection.id
  ) => {
    markSectionDirty(sectionId)
    setDraft((current) => current ? ensureHitPointLevels(produce(current, mutator)) : current)
  }

  if (isNew && !_characterId && !systemPref) {
    return (
      <Alert color='yellow' title='System Required'>
        Choose a system first so we can create a character draft against the right ruleset.
      </Alert>
    )
  }

  if (!loading && (!draft || !resolution || !persistedCharacter)) {
    return (
      <Alert color='red' title='Character Not Found'>
        We could not load this character builder payload.
      </Alert>
    )
  }

  if (loading || !draft || !resolution || !persistedCharacter) {
    return (
      <Group justify='center' py='xl'>
        <Loader />
      </Group>
    )
  }

  const subraceOptions = getSubraceOptions(baseRaces, draft.intent.race.raceId)

  const handleResetSection = () => {
    if (currentSection.id === 'REVIEW') {
      setDraft(ensureHitPointLevels(cloneCharacter(persistedCharacter)))
      setDirtySections({})
      setPendingSaveRequest(null)
      return
    }

    setDraft((current) => current
      ? ensureHitPointLevels(applySectionSnapshot(current, persistedCharacter, currentSection.id))
      : current)
    setDirtySections((current) => ({
      ...current,
      [currentSection.id]: false
    }))
  }

  const persistSectionSave = async (
    request: Omit<PendingSaveRequest, 'preview'>
  ) => {
    const payload = await saveMutation.mutateAsync({
      character: request.payloadCharacter,
      mode: builderMode,
      targetStatus: request.targetStatus
    })

    const savedCharacter = ensureHitPointLevels(payload.character)

    setPersistedCharacter(savedCharacter)
    setResolution(payload.resolution)
    setDraft(
      request.saveAll
        ? savedCharacter
        : ensureHitPointLevels(
            mergePreservedDirtySections(
              savedCharacter,
              request.stagedSnapshot,
              request.dirtySnapshot,
              request.sectionId
            )
          )
    )
    setDirtySections(clearDirtySectionsAfterSave(request.dirtySnapshot, request.sectionId, request.saveAll))
    setPendingSaveRequest(null)

    if (request.targetStatus === AUTHORED_RECORD_STATUS.ACTIVE && savedCharacter.status === AUTHORED_RECORD_STATUS.ACTIVE) {
      await navigate({
        to: '/characters/$characterId',
        params: {
          characterId: savedCharacter.id
        }
      })
      return
    }

    if (action === 'new' && _characterId !== savedCharacter.id) {
      await navigate({
        to: '/characters/$action/$_characterId',
        params: {
          action: 'new',
          _characterId: savedCharacter.id
        }
      })
    }

    if (request.goNext) {
      setActiveStep((current) => Math.min(current + 1, characterBuilderSections.length - 1))
    }
  }

  const handleSaveSection = async (options?: {
    goNext?: boolean
    saveAll?: boolean
    targetStatus?: AuthoredRecordStatus
  }) => {
    const dirtySnapshot = { ...dirtySections }
    const stagedSnapshot = cloneCharacter(draft)
    const saveAll = options?.saveAll ?? currentSection.id === 'REVIEW'
    const payloadCharacter = saveAll
      ? cloneCharacter(draft)
      : applySectionSnapshot(cloneCharacter(persistedCharacter), draft, currentSection.id)

    const previewPayload = await previewMutation.mutateAsync({
      character: payloadCharacter,
      mode: builderMode,
      targetStatus: options?.targetStatus
    })

    const request = {
      sectionId: currentSection.id,
      payloadCharacter,
      stagedSnapshot,
      dirtySnapshot,
      saveAll,
      goNext: options?.goNext,
      targetStatus: options?.targetStatus
    }

    if (previewPayload.preview.destructive) {
      setPendingSaveRequest({
        ...request,
        preview: previewPayload.preview
      })
      return
    }

    await persistSectionSave(request)
  }

  const renderAbilityAssignments = () => {
    switch (draft.intent.abilities.method) {
      case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
        return (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {abilityOrder.map((ability) => (
              <Select
                key={ability}
                label={abilityLabels[ability]}
                data={standardArrayOptions}
                value={draft.intent.abilities.assignments.find((entry) => entry.ability === ability)?.option ?? null}
                onChange={(value) => {
                  if (!value) return
                  patchDraft((current) => {
                    const existing = current.intent.abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY
                      ? current.intent.abilities.assignments.find((entry) => entry.ability === ability)
                      : undefined

                    if (current.intent.abilities.method !== CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY) {
                      return
                    }

                    if (existing) {
                      existing.option = value as typeof existing.option
                    } else {
                      current.intent.abilities.assignments.push({
                        ability,
                        option: value as (typeof current.intent.abilities.assignments)[number]['option']
                      })
                    }
                  }, 'ABILITIES')
                }}
              />
            ))}
          </SimpleGrid>
        )
      case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
        return (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {abilityOrder.map((ability) => (
              <Select
                key={ability}
                label={abilityLabels[ability]}
                data={pointBuyOptions}
                value={draft.intent.abilities.assignments.find((entry) => entry.ability === ability)?.option ?? null}
                onChange={(value) => {
                  if (!value) return
                  patchDraft((current) => {
                    if (current.intent.abilities.method !== CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
                      return
                    }

                    const existing = current.intent.abilities.assignments.find((entry) => entry.ability === ability)
                    if (existing) {
                      existing.option = value as typeof existing.option
                    } else {
                      current.intent.abilities.assignments.push({
                        ability,
                        option: value as (typeof current.intent.abilities.assignments)[number]['option']
                      })
                    }
                  }, 'ABILITIES')
                }}
              />
            ))}
          </SimpleGrid>
        )
      case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
        return (
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {abilityOrder.map((ability) => (
                <NumberInput
                  key={ability}
                  label={abilityLabels[ability]}
                  value={draft.intent.abilities.state.assignments.find((entry) => entry.ability === ability)?.score ?? 0}
                  onChange={(value) => {
                    patchDraft((current) => {
                      if (current.intent.abilities.method !== CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED) {
                        return
                      }

                      const normalized = Number(value ?? 0)
                      const existing = current.intent.abilities.state.assignments.find((entry) => entry.ability === ability)
                      if (existing) {
                        existing.score = normalized
                      } else {
                        current.intent.abilities.state.assignments.push({
                          ability,
                          score: normalized
                        })
                      }
                    }, 'ABILITIES')
                  }}
                />
              ))}
            </SimpleGrid>

            {draft.intent.abilities.state.rollGroups?.length ? (
              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Existing Roll Provenance</Text>
                <Stack gap='xs'>
                  {draft.intent.abilities.state.rollGroups.map((group) => (
                    <Text key={group.id} size='sm'>
                      {group.assignedAbility ? `${abilityLabels[group.assignedAbility]}: ` : ''}
                      kept {group.kept.map((roll) => roll.value).join(', ')} -> {group.score}
                    </Text>
                  ))}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        )
      default:
        return null
    }
  }

  const renderStartingEquipmentSection = (
    source: CharacterStartingEquipmentSource,
    definition?: StartingEquipmentAuthored
  ) => {
    if (!definition || definition.sets.length === 0) {
      return <Text c='dimmed' size='sm'>No authored starting equipment choices.</Text>
    }

    const decision = source === CharacterStartingEquipmentSource.CLASS
      ? draft.intent.startingEquipment?.class
      : draft.intent.startingEquipment?.background

    return (
      <Stack>
        {source === CharacterStartingEquipmentSource.CLASS ? (
          <Select
            label='Gold Instead'
            value={decision?.tookGold ? 'yes' : 'no'}
            data={[
              { value: 'no', label: 'Take starting equipment' },
              { value: 'yes', label: 'Take starting gold instead' }
            ]}
            onChange={(value) => {
              patchDraft((current) => {
                current.intent.startingEquipment ??= {}
                current.intent.startingEquipment.class = {
                  source: CharacterStartingEquipmentSource.CLASS,
                  tookGold: value === 'yes',
                  groups: current.intent.startingEquipment.class?.groups,
                  gold: current.intent.startingEquipment.class?.gold,
                  applied: current.intent.startingEquipment.class?.applied
                }
              }, 'EQUIPMENT')
            }}
          />
        ) : null}

        {definition.sets.map((set) => (
          <Card key={set.id} withBorder>
            <Stack>
              <Text fw={600}>Set {set.order}</Text>
              {set.groups.map((group) => {
                const selectedOptionId = decision?.groups?.find((record) => record.groupId === group.id)?.optionId ?? null

                return (
                  <Select
                    key={group.id}
                    label={`Group ${group.order}`}
                    value={selectedOptionId}
                    data={group.options.map((option) => ({
                      value: option.id,
                      label: summarizeOptionItems(option, equipmentLabels)
                    }))}
                    onChange={(value) => {
                      if (!value) return

                      patchDraft((current) => {
                        current.intent.startingEquipment ??= {}
                        const key = source === CharacterStartingEquipmentSource.CLASS ? 'class' : 'background'
                        const existingDecision = current.intent.startingEquipment[key] ?? {
                          source,
                          tookGold: false,
                          groups: []
                        }
                        existingDecision.groups ??= []

                        const existingGroup = existingDecision.groups.find((record) => record.groupId === group.id)
                        if (existingGroup) {
                          existingGroup.optionId = value
                        } else {
                          existingDecision.groups.push({
                            groupId: group.id,
                            optionId: value,
                            selections: []
                          })
                        }

                        current.intent.startingEquipment[key] = existingDecision
                      }, 'EQUIPMENT')
                    }}
                  />
                )
              })}
            </Stack>
          </Card>
        ))}
      </Stack>
    )
  }

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-start'>
        <div>
          <Title order={2}>
            {isNew
              ? (_characterId ? 'Continue Character Draft' : 'Create Character')
              : 'Edit Character'}
          </Title>
          <Text c='dimmed'>
            {isNew
              ? 'Creation stays in draft mode until you finalize the build.'
              : 'Structural edits happen here; play-state changes stay on the character sheet.'}
          </Text>
        </div>

        <Group>
          <Badge variant='light'>2014 Rules</Badge>
          <Badge variant='light'>{resolution.summary.totalLevel || 0} levels</Badge>
          <Badge color={getStatusColor(persistedCharacter.status)}>
            {getStatusLabel(persistedCharacter.status)}
          </Badge>
          {unsavedSectionCount > 0 ? (
            <Badge color='orange'>{unsavedSectionCount} unsaved section{unsavedSectionCount === 1 ? '' : 's'}</Badge>
          ) : null}
        </Group>
      </Group>

      <Alert color='blue' title='Screen-staged builder'>
        Changes stay local until you save a section. If a section save would remove invalid downstream choices or move an active character back to draft, we&apos;ll preview that before anything is persisted.
      </Alert>

      {resolution.validations.length > 0 ? (
        <Alert color='yellow' title='Validation Summary'>
          <Stack gap={4}>
            {resolution.validations.map((validation) => (
              <Text key={`${validation.code}:${validation.message}`} size='sm'>
                {validation.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}

      <Stepper active={activeStep} allowNextStepsSelect={false}>
        <Stepper.Step label='Home' description='Identity'>
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label='Name'
                value={draft.label}
                onChange={(event) => updateDraft((current) => ({ ...current, label: event.currentTarget.value }), 'HOME')}
              />

              <Select
                label='Advancement Method'
                data={advancementOptions}
                value={draft.intent.advancement.method}
                onChange={(value) => {
                  if (!value) return
                  patchDraft((current) => {
                    current.intent.advancement = value === ADVANCEMENT_METHOD_CODE.EXPERIENCE
                      ? {
                          method: ADVANCEMENT_METHOD_CODE.EXPERIENCE,
                          experience: current.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE
                            ? current.intent.advancement.experience
                            : undefined
                        }
                      : { method: ADVANCEMENT_METHOD_CODE.MILESTONE }
                  }, 'HOME')
                }}
              />
            </SimpleGrid>

            {draft.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE ? (
              <NumberInput
                label='Experience'
                value={draft.intent.advancement.experience ?? 0}
                onChange={(value) => {
                  patchDraft((current) => {
                    if (current.intent.advancement.method === ADVANCEMENT_METHOD_CODE.EXPERIENCE) {
                      current.intent.advancement.experience = Number(value ?? 0)
                    }
                  }, 'HOME')
                }}
              />
            ) : null}

            <Textarea
              label='Description'
              minRows={4}
              value={draft.description ?? ''}
              onChange={(event) => updateDraft((current) => ({
                ...current,
                description: event.currentTarget.value || undefined
              }), 'HOME')}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Species' description='Race & ancestry'>
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label='Race'
                data={baseRaceOptions}
                value={draft.intent.race.raceId || null}
                onChange={(value) => {
                  patchDraft((current) => {
                    current.intent.race.raceId = value ?? ''
                    current.intent.race.subraceId = undefined
                    current.intent.ancestrySelections = undefined
                  }, 'SPECIES')
                }}
              />

              <Select
                label='Subrace'
                data={subraceOptions}
                value={draft.intent.race.subraceId ?? null}
                onChange={(value) => {
                  patchDraft((current) => {
                    current.intent.race.subraceId = value ?? undefined
                    current.intent.ancestrySelections = undefined
                  }, 'SPECIES')
                }}
                disabled={!draft.intent.race.raceId}
              />
            </SimpleGrid>

            {selectedResolvedRace?.ancestry ? (
              <Select
                label={selectedResolvedRace.ancestry.label}
                data={selectedResolvedRace.ancestry.options.map((option) => ({
                  value: option.id,
                  label: option.label
                }))}
                value={draft.intent.ancestrySelections?.find((selection) => selection.ancestryId === selectedResolvedRace.ancestry?.id)?.optionId ?? null}
                onChange={(value) => {
                  if (!value || !selectedResolvedRace?.ancestry) return

                  patchDraft((current) => {
                    const ancestryId = selectedResolvedRace.ancestry.id
                    const selectionSource = current.intent.race.subraceId
                      ? { kind: 'SUBRACE' as const, subraceId: current.intent.race.subraceId }
                      : { kind: 'RACE' as const, raceId: current.intent.race.raceId }

                    current.intent.ancestrySelections = [
                      {
                        id: current.intent.ancestrySelections?.[0]?.id ?? uuidv4(),
                        ancestryId,
                        optionId: value,
                        source: selectionSource,
                        timing: { kind: 'IMMEDIATE' }
                      }
                    ]

                    current.intent.featureAcquisitions = current.intent.featureAcquisitions.filter((record) =>
                      !(record.source.kind === 'ANCESTRY' && record.source.ancestryId === ancestryId)
                    )

                    const option = selectedResolvedRace.ancestry?.options.find((record) => record.id === value)
                    for (const feature of option?.features ?? []) {
                      current.intent.featureAcquisitions.push(buildFeatureAcquisition(feature.id, {
                        kind: 'ANCESTRY',
                        ancestryId,
                        optionId: value
                      }))
                    }
                  }, 'SPECIES')
                }}
              />
            ) : null}

            {resolution.summary.selectedRace ? (
              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Resolved Species Summary</Text>
                <Stack gap={4}>
                  <Text size='sm'>Race: {resolution.summary.selectedRace.raceLabel}</Text>
                  {resolution.summary.selectedRace.subraceLabel ? (
                    <Text size='sm'>Subrace: {resolution.summary.selectedRace.subraceLabel}</Text>
                  ) : null}
                  {resolution.summary.selectedRace.ancestryOptionLabel ? (
                    <Text size='sm'>
                      {resolution.summary.selectedRace.ancestryLabel}: {resolution.summary.selectedRace.ancestryOptionLabel}
                    </Text>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Classes' description='Progression'>
          <Stack>
            {draft.intent.classes.map((row, index) => {
              const subclassOptions = getSubclassOptions(classes, row.classId)
              const selectedSubclass = classes.find((record) => record.id === row.subclassId && record.category === 'SUBCLASS')

              return (
                <Card key={`${row.classId}:${index}`} withBorder>
                  <Stack>
                    <Group justify='space-between'>
                      <Text fw={600}>Class Row {index + 1}</Text>
                      <Button
                        variant='subtle'
                        color='red'
                        onClick={() => patchDraft((current) => {
                          current.intent.classes.splice(index, 1)
                        }, 'CLASSES')}
                      >
                        Remove
                      </Button>
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <Select
                        label='Class'
                        data={classOptions}
                        value={row.classId || null}
                        onChange={(value) => patchDraft((current) => {
                          current.intent.classes[index].classId = value ?? ''
                          current.intent.classes[index].subclassId = undefined
                          current.intent.classes[index].specializationId = undefined
                        }, 'CLASSES')}
                      />

                      <NumberInput
                        label='Class Level'
                        min={1}
                        value={row.classLevel}
                        onChange={(value) => patchDraft((current) => {
                          current.intent.classes[index].classLevel = Math.max(1, Number(value ?? 1))
                        }, 'CLASSES')}
                      />

                      <Select
                        label='Subclass'
                        data={subclassOptions}
                        value={row.subclassId ?? null}
                        onChange={(value) => patchDraft((current) => {
                          current.intent.classes[index].subclassId = value ?? undefined
                          current.intent.classes[index].specializationId = undefined
                        }, 'CLASSES')}
                      />

                      <Select
                        label='Specialization'
                        data={(selectedSubclass?.specializations ?? []).map((specialization) => ({
                          value: specialization.id,
                          label: specialization.label
                        }))}
                        value={row.specializationId ?? null}
                        onChange={(value) => patchDraft((current) => {
                          current.intent.classes[index].specializationId = value ?? undefined
                        }, 'CLASSES')}
                        disabled={!selectedSubclass?.specializations?.length}
                      />
                    </SimpleGrid>
                  </Stack>
                </Card>
              )
            })}

            <Button
              variant='light'
              onClick={() => patchDraft((current) => {
                current.intent.classes.push({
                  classId: '',
                  classLevel: 1
                })
              }, 'CLASSES')}
            >
              Add Class
            </Button>

            <Paper withBorder p='md'>
              <Text fw={600} mb='xs'>Granted Summary</Text>
              <Stack gap='sm'>
                {resolution.summary.classes.length === 0 ? (
                  <Text c='dimmed' size='sm'>No classes selected yet.</Text>
                ) : resolution.summary.classes.map((entry) => (
                  <div key={`${entry.classId}:${entry.classLevel}:${entry.subclassId ?? 'base'}`}>
                    <Text fw={500} size='sm'>
                      {entry.classLabel} {entry.subclassLabel ? ` / ${entry.subclassLabel}` : ''} (Level {entry.classLevel})
                    </Text>
                    <Text size='sm' c='dimmed'>
                      Features: {entry.featureLabels.join(', ') || 'None'} | Resources: {entry.resourceLabels.join(', ') || 'None'} | Spellcasting: {entry.spellcastingLabels.join(', ') || 'None'}
                    </Text>
                  </div>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Background' description='Profile'>
          <Stack>
            <Select
              label='Background'
              data={backgroundOptions}
              value={draft.intent.background.backgroundId || null}
              onChange={(value) => patchDraft((current) => {
                current.intent.background.backgroundId = value ?? ''
              }, 'BACKGROUND')}
            />

            <Divider label='Character Details' labelPosition='left' />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Select
                label='Alignment'
                data={(system?.alignments ?? []).map((record) => ({ value: record.id, label: record.label }))}
                value={draft.profile.alignmentId ?? null}
                onChange={(value) => patchDraft((current) => {
                  current.profile.alignmentId = value ?? undefined
                }, 'BACKGROUND')}
              />
              <Select
                label='Lifestyle'
                data={(system?.lifestyles ?? []).map((record) => ({ value: record.id, label: record.label }))}
                value={draft.profile.lifestyleId ?? null}
                onChange={(value) => patchDraft((current) => {
                  current.profile.lifestyleId = value ?? undefined
                }, 'BACKGROUND')}
              />
              <TextInput label='Faith' value={draft.profile.faith ?? ''} onChange={(event) => patchDraft((current) => { current.profile.faith = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Gender' value={draft.profile.gender ?? ''} onChange={(event) => patchDraft((current) => { current.profile.gender = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Age' value={draft.profile.age ?? ''} onChange={(event) => patchDraft((current) => { current.profile.age = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            </SimpleGrid>

            <Divider label='Physical Characteristics' labelPosition='left' />
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput label='Eyes' value={draft.profile.eyes ?? ''} onChange={(event) => patchDraft((current) => { current.profile.eyes = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Hair' value={draft.profile.hair ?? ''} onChange={(event) => patchDraft((current) => { current.profile.hair = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Skin' value={draft.profile.skin ?? ''} onChange={(event) => patchDraft((current) => { current.profile.skin = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Height' value={draft.profile.height ?? ''} onChange={(event) => patchDraft((current) => { current.profile.height = event.currentTarget.value || undefined }, 'BACKGROUND')} />
              <TextInput label='Weight' value={draft.profile.weight ?? ''} onChange={(event) => patchDraft((current) => { current.profile.weight = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            </SimpleGrid>

            <Textarea label='Physical Characteristics' minRows={3} value={draft.profile.physicalCharacteristics ?? ''} onChange={(event) => patchDraft((current) => { current.profile.physicalCharacteristics = event.currentTarget.value || undefined }, 'BACKGROUND')} />

            <Divider label='Personal Characteristics' labelPosition='left' />
            <Textarea label='Personality Traits' minRows={2} value={draft.profile.personalityTraits ?? ''} onChange={(event) => patchDraft((current) => { current.profile.personalityTraits = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Ideals' minRows={2} value={draft.profile.ideals ?? ''} onChange={(event) => patchDraft((current) => { current.profile.ideals = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Bonds' minRows={2} value={draft.profile.bonds ?? ''} onChange={(event) => patchDraft((current) => { current.profile.bonds = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Flaws' minRows={2} value={draft.profile.flaws ?? ''} onChange={(event) => patchDraft((current) => { current.profile.flaws = event.currentTarget.value || undefined }, 'BACKGROUND')} />

            <Divider label='Other Notes' labelPosition='left' />
            <Textarea label='Organizations' minRows={2} value={draft.profile.organizations ?? ''} onChange={(event) => patchDraft((current) => { current.profile.organizations = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Allies' minRows={2} value={draft.profile.allies ?? ''} onChange={(event) => patchDraft((current) => { current.profile.allies = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Enemies' minRows={2} value={draft.profile.enemies ?? ''} onChange={(event) => patchDraft((current) => { current.profile.enemies = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Backstory' minRows={4} value={draft.profile.backstory ?? ''} onChange={(event) => patchDraft((current) => { current.profile.backstory = event.currentTarget.value || undefined }, 'BACKGROUND')} />
            <Textarea label='Notes' minRows={4} value={draft.profile.notes ?? ''} onChange={(event) => patchDraft((current) => { current.profile.notes = event.currentTarget.value || undefined }, 'BACKGROUND')} />
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Abilities & HP' description='Scores'>
          <Stack>
            <Select
              label='Ability Generation Method'
              data={abilityMethodOptions}
              value={draft.intent.abilities.method}
              onChange={(value) => {
                if (!value) return
                patchDraft((current) => {
                  if (value === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY) {
                    current.intent.abilities = {
                      method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
                      assignments: []
                    }
                  } else if (value === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
                    current.intent.abilities = {
                      method: CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY,
                      assignments: []
                    }
                  } else {
                    current.intent.abilities = {
                      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
                      state: {
                        assignments: []
                      }
                    }
                  }
                }, 'ABILITIES')
              }}
            />

            {renderAbilityAssignments()}

            <Divider label='Hit Points' labelPosition='left' />

            <Select
              label='Hit Point Method'
              data={hitPointMethodOptions}
              value={draft.intent.hitpoints.method}
              onChange={(value) => {
                if (!value) return
                patchDraft((current) => {
                  current.intent.hitpoints.method = value as typeof current.intent.hitpoints.method
                }, 'ABILITIES')
              }}
            />

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              {draft.intent.hitpoints.levels.map((level, index) => (
                <NumberInput
                  key={level.level}
                  label={`Level ${level.level}`}
                  value={level.value}
                  onChange={(value) => patchDraft((current) => {
                    current.intent.hitpoints.levels[index].value = Number(value ?? 0)
                  }, 'ABILITIES')}
                />
              ))}
            </SimpleGrid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Equipment' description='Starting gear'>
          <Stack>
            <Paper withBorder p='md'>
              <Text fw={600} mb='xs'>Class Starting Equipment</Text>
              {renderStartingEquipmentSection(CharacterStartingEquipmentSource.CLASS, primaryClass?.startingEquipment)}
            </Paper>

            <Paper withBorder p='md'>
              <Text fw={600} mb='xs'>Background Starting Equipment</Text>
              {renderStartingEquipmentSection(CharacterStartingEquipmentSource.BACKGROUND, selectedBackground?.startingEquipment)}
            </Paper>

            {isNew ? (
              <>
                <Divider label='Manual Inventory Seed' labelPosition='left' />
                <Stack gap='sm'>
                  {draft.state.equipment.inventory.map((item, index) => (
                    <SimpleGrid key={item.id} cols={{ base: 1, md: 3 }}>
                      <TextInput
                        label='Equipment Id'
                        value={item.equipmentId}
                        onChange={(event) => patchDraft((current) => {
                          current.state.equipment.inventory[index].equipmentId = event.currentTarget.value
                        }, 'EQUIPMENT')}
                      />
                      <NumberInput
                        label='Quantity'
                        value={item.quantity}
                        onChange={(value) => patchDraft((current) => {
                          current.state.equipment.inventory[index].quantity = Number(value ?? 0)
                        }, 'EQUIPMENT')}
                      />
                      <TextInput
                        label='Custom Name'
                        value={item.customName ?? ''}
                        onChange={(event) => patchDraft((current) => {
                          current.state.equipment.inventory[index].customName = event.currentTarget.value || undefined
                        }, 'EQUIPMENT')}
                      />
                    </SimpleGrid>
                  ))}

                  <Button
                    variant='light'
                    onClick={() => patchDraft((current) => {
                      current.state.equipment.inventory.push({
                        id: uuidv4(),
                        equipmentId: '',
                        quantity: 1
                      })
                    }, 'EQUIPMENT')}
                  >
                    Add Inventory Row
                  </Button>
                </Stack>

                <Divider label='Currency Seed' labelPosition='left' />
                <Stack gap='sm'>
                  {(draft.state.currency[0]?.currencies ?? []).map((currency, index) => (
                    <SimpleGrid key={`${currency.currencyId}:${index}`} cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label='Currency Id'
                        value={currency.currencyId}
                        onChange={(event) => patchDraft((current) => {
                          current.state.currency[0].currencies[index].currencyId = event.currentTarget.value
                        }, 'EQUIPMENT')}
                      />
                      <NumberInput
                        label='Amount'
                        value={currency.amount}
                        onChange={(value) => patchDraft((current) => {
                          current.state.currency[0].currencies[index].amount = Number(value ?? 0)
                        }, 'EQUIPMENT')}
                      />
                    </SimpleGrid>
                  ))}

                  <Button
                    variant='light'
                    onClick={() => patchDraft((current) => {
                      current.state.currency[0] ??= {
                        currencies: []
                      }
                      current.state.currency[0].currencies.push({
                        currencyId: '',
                        amount: 0
                      })
                    }, 'EQUIPMENT')}
                  >
                    Add Currency Row
                  </Button>
                </Stack>
              </>
            ) : (
              <Alert color='blue' title='Sheet-owned play state'>
                Inventory, currency, equipped items, and attunement are handled on the sheet and play surfaces. The structural builder only manages starting-equipment intent here.
              </Alert>
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Selections' description='Outstanding choices'>
          <Stack>
            <Paper withBorder p='md'>
              <Text fw={600} mb='xs'>Outstanding Choices</Text>
              {resolution.outstandingChoices.length === 0 ? (
                <Text c='dimmed' size='sm'>No unresolved builder choices right now.</Text>
              ) : (
                <Stack gap='xs'>
                  {resolution.outstandingChoices.map((choice) => (
                    <Alert key={`${choice.code}:${choice.message}`} color={choice.required ? 'yellow' : 'blue'}>
                      <Text fw={500}>{choice.sourceLabel}</Text>
                      <Text size='sm'>{choice.message}</Text>
                    </Alert>
                  ))}
                </Stack>
              )}
            </Paper>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Feature Acquisitions</Text>
                <Stack gap='xs'>
                  {draft.intent.featureAcquisitions.length === 0 ? (
                    <Text c='dimmed' size='sm'>No explicit feature acquisitions recorded.</Text>
                  ) : draft.intent.featureAcquisitions.map((record) => (
                    <Text key={record.id} size='sm'>
                      {record.featureId} | {record.source.kind}
                    </Text>
                  ))}
                </Stack>
              </Paper>

              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Spell Selections</Text>
                <Stack gap='xs'>
                  {(draft.intent.spellSelections ?? []).length === 0 ? (
                    <Text c='dimmed' size='sm'>No explicit spell selections recorded.</Text>
                  ) : draft.intent.spellSelections?.map((record) => (
                    <Text key={record.id} size='sm'>
                      {record.source.kind} | {record.spells.join(', ')}
                    </Text>
                  ))}
                </Stack>
              </Paper>
            </SimpleGrid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step label='Review' description='Finalize'>
          <Stack>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Build Summary</Text>
                <Stack gap={4}>
                  <Text size='sm'>Name: {draft.label || 'Untitled character'}</Text>
                  <Text size='sm'>Level: {resolution.summary.totalLevel}</Text>
                  <Text size='sm'>Race: {resolution.summary.selectedRace?.raceLabel ?? 'Not selected'}</Text>
                  <Text size='sm'>Background: {resolution.summary.selectedBackground?.label ?? 'Not selected'}</Text>
                </Stack>
              </Paper>

              <Paper withBorder p='md'>
                <Text fw={600} mb='xs'>Readiness</Text>
                <Stack gap='xs'>
                  <Badge color={resolution.readiness.ready ? 'green' : 'yellow'}>
                    {resolution.readiness.ready ? 'Ready to Finalize' : 'Needs Attention'}
                  </Badge>
                  {resolution.readiness.blockingIssues.map((issue) => (
                    <Text key={issue} size='sm'>{issue}</Text>
                  ))}
                  {resolution.readiness.outstandingRequiredChoices.map((issue) => (
                    <Text key={issue} size='sm'>{issue}</Text>
                  ))}
                </Stack>
              </Paper>
            </SimpleGrid>

            <Paper withBorder p='md'>
              <Text fw={600} mb='xs'>Granted Content</Text>
              <ScrollArea.Autosize mah={280}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Label</Table.Th>
                      <Table.Th>Source</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {resolution.grants.features.map((item) => (
                      <Table.Tr key={`feature:${item.id}:${item.sourceLabel}`}>
                        <Table.Td>Feature</Table.Td>
                        <Table.Td>{item.label}</Table.Td>
                        <Table.Td>{item.sourceLabel}</Table.Td>
                      </Table.Tr>
                    ))}
                    {resolution.grants.resources.map((item) => (
                      <Table.Tr key={`resource:${item.id}:${item.sourceLabel}`}>
                        <Table.Td>Resource</Table.Td>
                        <Table.Td>{item.label}</Table.Td>
                        <Table.Td>{item.sourceLabel}</Table.Td>
                      </Table.Tr>
                    ))}
                    {resolution.grants.spellcasting.map((item) => (
                      <Table.Tr key={`spellcasting:${item.id}:${item.sourceLabel}`}>
                        <Table.Td>Spellcasting</Table.Td>
                        <Table.Td>{item.label}</Table.Td>
                        <Table.Td>{item.sourceLabel}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Paper>
          </Stack>
        </Stepper.Step>
      </Stepper>

      <Modal
        opened={Boolean(pendingSaveRequest)}
        onClose={() => setPendingSaveRequest(null)}
        title='Review structural changes'
        centered
      >
        <Stack gap='md'>
          <Text size='sm'>
            Saving this section will update the persisted character with the structural changes below.
          </Text>

          {pendingSaveRequest?.preview.summaryLines.map((line) => (
            <Alert
              key={line}
              color={line.includes('Draft') ? 'yellow' : 'blue'}
            >
              {line}
            </Alert>
          ))}

          {pendingSaveRequest?.preview.removedAncestrySelections.length ? (
            <Paper withBorder p='sm'>
              <Text fw={600} size='sm' mb='xs'>Removed ancestry selections</Text>
              <Stack gap={4}>
                {pendingSaveRequest.preview.removedAncestrySelections.map((entry) => (
                  <Text key={entry.id} size='sm'>{entry.label}</Text>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {pendingSaveRequest?.preview.removedFeatureAcquisitions.length ? (
            <Paper withBorder p='sm'>
              <Text fw={600} size='sm' mb='xs'>Removed feature acquisitions</Text>
              <Stack gap={4}>
                {pendingSaveRequest.preview.removedFeatureAcquisitions.map((entry) => (
                  <Text key={entry.id} size='sm'>{entry.label}</Text>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {pendingSaveRequest?.preview.removedSpellSelections.length ? (
            <Paper withBorder p='sm'>
              <Text fw={600} size='sm' mb='xs'>Removed spell selections</Text>
              <Stack gap={4}>
                {pendingSaveRequest.preview.removedSpellSelections.map((entry) => (
                  <Text key={entry.id} size='sm'>{entry.label}</Text>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {pendingSaveRequest?.preview.removedResourceGrants.length ? (
            <Paper withBorder p='sm'>
              <Text fw={600} size='sm' mb='xs'>Removed resource grants</Text>
              <Stack gap={4}>
                {pendingSaveRequest.preview.removedResourceGrants.map((entry) => (
                  <Text key={entry.id} size='sm'>{entry.label}</Text>
                ))}
              </Stack>
            </Paper>
          ) : null}

          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setPendingSaveRequest(null)}>
              Cancel
            </Button>
            <Button
              loading={saveMutation.isPending}
              onClick={() => pendingSaveRequest && void persistSectionSave(pendingSaveRequest)}
            >
              Confirm Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper withBorder p='md'>
        <Group justify='space-between' align='center'>
          <Stack gap={2}>
            <Text fw={600}>{currentSection.label}</Text>
            <Text size='sm' c='dimmed'>
              {currentSectionDirty
                ? 'This section has local staged changes.'
                : 'This section matches the last saved draft.'}
            </Text>
          </Stack>

          <Group>
            <Button
              variant='default'
              disabled={activeStep === 0}
              onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
            >
              Previous
            </Button>

            <Button
              variant='subtle'
              disabled={previewMutation.isPending || saveMutation.isPending || (currentSection.id === 'REVIEW' ? unsavedSectionCount === 0 : !currentSectionDirty)}
              onClick={handleResetSection}
            >
              {currentSection.id === 'REVIEW' ? 'Reset Pending Changes' : 'Reset Section'}
            </Button>

            {currentSection.id === 'REVIEW' ? (
              <Button
                loading={previewMutation.isPending || saveMutation.isPending}
                disabled={!resolution.readiness.ready}
                onClick={() => void handleSaveSection({
                  saveAll: true,
                  targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
                })}
              >
                {isNew || persistedCharacter.status !== AUTHORED_RECORD_STATUS.ACTIVE
                  ? 'Finalize Character'
                  : 'Finalize Changes'}
              </Button>
            ) : (
              <>
                <Button
                  variant='default'
                  loading={previewMutation.isPending || saveMutation.isPending}
                  disabled={!currentSectionDirty}
                  onClick={() => void handleSaveSection()}
                >
                  Save Section
                </Button>

                <Button
                  loading={previewMutation.isPending || saveMutation.isPending}
                  disabled={activeStep >= characterBuilderSections.length - 1}
                  onClick={() => {
                    if (currentSectionDirty) {
                      void handleSaveSection({ goNext: true })
                      return
                    }
                    setActiveStep((current) => Math.min(current + 1, characterBuilderSections.length - 1))
                  }}
                >
                  {currentSectionDirty ? 'Save & Next' : 'Next'}
                </Button>
              </>
            )}
          </Group>
        </Group>
      </Paper>
    </Stack>
  )
}

export default CharacterForm
