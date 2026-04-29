import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title
} from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleAlert, Plus, Sparkles, Trash2 } from 'lucide-react'

import { Route } from '#routes/_authed/characters/$action/$_characterId'
import { AUTHORED_RECORD_STATUS, type CharacterAuthored } from '@artificer-toolkit/shared'
import type {
  CharacterBuilderPayloadDto,
  CharacterBuilderResolutionDto,
  ClassAuthoredDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema'
import { getBackgroundList } from '../../../data/backgrounds'
import { getCharacterBuilder, getCharacterDraft } from '../../../data/characters/queries'
import {
  usePreviewCharacterBuilderSave,
  useResolveCharacterBuilder,
  useUpsertCharacterBuilder
} from '../../../data/characters/mutations'
import { getClass, getClassList } from '../../../data/classes'
import { getRace, getRaceList } from '../../../data/races'
import { getSystemList } from '../../../data/systems'

type SectionId =
  | 'BASICS'
  | 'RACE'
  | 'CLASSES'
  | 'BACKGROUND'
  | 'DETAILS'
  | 'NOTES'
  | 'ABILITIES'
  | 'EQUIPMENT'
  | 'REVIEW'

const sections: { id: SectionId, short: string, title: string, description: string }[] = [
  {
    id: 'BASICS',
    short: 'CC1',
    title: 'Character Basics',
    description: 'Set the name, concept, system, and advancement direction for the build.'
  },
  {
    id: 'RACE',
    short: 'CC2',
    title: 'Character Race',
    description: 'Choose the race, optional subrace, and any inline ancestry choices.'
  },
  {
    id: 'CLASSES',
    short: 'CC3',
    title: 'Character Classes',
    description: 'Manage class structure, level progression, subclass picks, and spellcasting context.'
  },
  {
    id: 'BACKGROUND',
    short: 'CC4',
    title: 'Character Background',
    description: 'Choose the background that anchors proficiencies, story framing, and starting context.'
  },
  {
    id: 'DETAILS',
    short: 'CC5',
    title: 'Character Details',
    description: 'Capture profile details and physical description without forcing play-state editing onto the sheet.'
  },
  {
    id: 'NOTES',
    short: 'CC6',
    title: 'Personality and Notes',
    description: 'Use real textareas for longform personality, backstory, and campaign reference.'
  },
  {
    id: 'ABILITIES',
    short: 'CC7',
    title: 'Abilities and Hit Points',
    description: 'Assign the six ability scores and establish hit point intent level by level.'
  },
  {
    id: 'EQUIPMENT',
    short: 'CC8',
    title: 'Equipment and Currency',
    description: 'Review inventory, currency, and outstanding starting equipment choices from their source screens.'
  },
  {
    id: 'REVIEW',
    short: 'CC9',
    title: 'Character Review',
    description: 'Review concrete missing items, validate the build, and save with a plain-language preview.'
  }
]

const heroStyle = {
  background: 'linear-gradient(135deg, rgba(24, 28, 43, 0.98), rgba(82, 44, 33, 0.92))',
  border: '1px solid rgba(255,255,255,0.08)',
  color: 'white'
} as const

const panelStyle = {
  background: 'linear-gradient(180deg, rgba(248, 244, 235, 0.98), rgba(238, 231, 220, 0.98))',
  border: '1px solid rgba(78, 55, 36, 0.14)'
} as const

const abilityLabels = {
  STRENGTH: 'Strength',
  DEXTERITY: 'Dexterity',
  CONSTITUTION: 'Constitution',
  INTELLIGENCE: 'Intelligence',
  WISDOM: 'Wisdom',
  CHARISMA: 'Charisma'
} as const

const abilityKeys = Object.keys(abilityLabels) as (keyof typeof abilityLabels)[]
const standardArrayOptions = ['8', '10', '12', '13', '14', '15']
const pointBuyOptions = ['8', '9', '10', '11', '12', '13', '14', '15']

function cloneAndUpdateCharacter(
  character: CharacterAuthored,
  updater: (draft: CharacterAuthored) => void
) {
  const next = structuredClone(character)
  updater(next)
  return next
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function deriveAbilityScores(character: CharacterAuthored) {
  switch (character.intent.abilities.method) {
    case 'STANDARD_ARRAY':
    case 'POINT_BUY':
      return Object.fromEntries(
        character.intent.abilities.assignments.map((assignment) => [
          assignment.ability,
          Number(assignment.option)
        ])
      ) as Partial<Record<string, number>>
    case 'MANUAL_ROLLED':
      return Object.fromEntries(
        character.intent.abilities.state.assignments.map((assignment) => [
          assignment.ability,
          assignment.score
        ])
      ) as Partial<Record<string, number>>
    default:
      return {}
  }
}

function meetsMulticlassRequirement(
  classDetail: ClassAuthoredDto,
  abilityScores: Partial<Record<string, number>>
) {
  if (classDetail.category !== 'BASE') {
    return true
  }

  return classDetail.multiclass.requirementGroups.groups.some((group) =>
    group.requirements.every((requirement) => (abilityScores[requirement.ability] ?? 0) >= requirement.min)
  )
}

function findSectionIndex(sectionId: SectionId) {
  return Math.max(sections.findIndex((section) => section.id === sectionId), 0)
}

function renderIssueList(
  title: string,
  items: string[],
  color: 'orange' | 'yellow' | 'blue'
) {
  if (items.length === 0) {
    return null
  }

  return (
    <Alert color={color} title={title}>
      <Stack gap={6}>
        {items.map((item) => (
          <Text key={item} size='sm'>{item}</Text>
        ))}
      </Stack>
    </Alert>
  )
}

const CharacterForm = () => {
  const params = Route.useParams()
  const navigate = useNavigate()
  const generatedIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'new-character'
  )
  const loadedCharacterIdRef = useRef<string | null>(null)

  const isEditMode = params.action === 'edit' && Boolean(params._characterId)
  const mode = isEditMode ? 'edit' : 'create'
  const characterId = params._characterId || generatedIdRef.current

  const [selectedSystemId, setSelectedSystemId] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('selectedSystem') ?? ''
  })
  const [draft, setDraft] = useState<CharacterAuthored | null>(null)
  const [sectionId, setSectionId] = useState<SectionId>('BASICS')
  const [liveResolution, setLiveResolution] = useState<CharacterBuilderResolutionDto | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pendingSaveTarget, setPendingSaveTarget] = useState<'draft' | 'active'>('draft')

  const systemsQuery = useQuery(getSystemList())
  const raceListQuery = useQuery(getRaceList())
  const classListQuery = useQuery(getClassList())
  const backgroundListQuery = useQuery(getBackgroundList())

  const builderQuery = useQuery({
    ...getCharacterBuilder(characterId),
    enabled: isEditMode
  })
  const draftQuery = useQuery({
    ...getCharacterDraft(characterId, selectedSystemId),
    enabled: !isEditMode && Boolean(characterId && selectedSystemId)
  })

  const resolveMutation = useResolveCharacterBuilder()
  const previewMutation = usePreviewCharacterBuilderSave()
  const upsertMutation = useUpsertCharacterBuilder()

  const sourcePayload: CharacterBuilderPayloadDto | null = isEditMode
    ? (builderQuery.data ?? null)
    : (draftQuery.data ?? null)

  useEffect(() => {
    if (!selectedSystemId && systemsQuery.data?.length) {
      const nextSystemId = systemsQuery.data[0]?.id ?? ''
      if (nextSystemId) {
        setSelectedSystemId(nextSystemId)
      }
    }
  }, [selectedSystemId, systemsQuery.data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('selectedSystem', selectedSystemId)
  }, [selectedSystemId])

  useEffect(() => {
    if (!sourcePayload) return
    if (loadedCharacterIdRef.current === sourcePayload.character.id) return

    loadedCharacterIdRef.current = sourcePayload.character.id
    setDraft(sourcePayload.character)
    setLiveResolution(sourcePayload.resolution)
    setSectionId((sourcePayload.resolution.recommendedSectionId as SectionId) ?? 'BASICS')
  }, [sourcePayload])

  useEffect(() => {
    if (!draft) return

    const requiredLevelCount = Math.max(
      draft.intent.classes.reduce((sum, entry) => sum + entry.classLevel, 0),
      1
    )

    if (draft.intent.hitpoints.levels.length === requiredLevelCount) {
      return
    }

    setDraft((current) => {
      if (!current) return current
      return cloneAndUpdateCharacter(current, (next) => {
        const levels = [...next.intent.hitpoints.levels]
        while (levels.length < requiredLevelCount) {
          levels.push({
            level: levels.length + 1,
            value: 1
          })
        }
        next.intent.hitpoints.levels = levels.slice(0, requiredLevelCount).map((entry, index) => ({
          ...entry,
          level: index + 1
        }))
      })
    })
  }, [draft])

  useEffect(() => {
    if (!draft) return

    const timeout = window.setTimeout(async () => {
      try {
        const payload = await resolveMutation.mutateAsync({
          character: draft,
          mode
        })
        setLiveResolution(payload.resolution)
      } catch {
        // Keep the latest good resolution visible while edits are in progress.
      }
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [draft, mode, resolveMutation])

  const raceItems = raceListQuery.data?.items ?? []
  const classItems = classListQuery.data?.items ?? []
  const backgroundItems = backgroundListQuery.data?.items ?? []

  const raceDetailQueries = useQueries({
    queries: raceItems.map((item) => ({
      ...getRace(item.id),
      enabled: Boolean(item.id)
    }))
  })
  const classDetailQueries = useQueries({
    queries: classItems.map((item) => ({
      ...getClass(item.id),
      enabled: Boolean(item.id)
    }))
  })

  const raceDetails = raceDetailQueries
    .map((query) => query.data)
    .filter((detail): detail is RaceAuthoredDto => Boolean(detail))
  const classDetails = classDetailQueries
    .map((query) => query.data)
    .filter((detail): detail is ClassAuthoredDto => Boolean(detail))

  const baseRaceDetails = raceDetails.filter((detail) => detail.category === 'BASE')
  const subraceDetails = raceDetails.filter((detail) => detail.category === 'SUBRACE')
  const classDetailMap = Object.fromEntries(classDetails.map((detail) => [detail.id, detail]))
  const selectedRaceDetail = draft?.intent.race.raceId
    ? baseRaceDetails.find((detail) => detail.id === draft.intent.race.raceId)
    : undefined
  const selectedSubraceOptions = selectedRaceDetail
    ? subraceDetails.filter((detail) => detail.parentRaceId === selectedRaceDetail.id)
    : []
  const abilityScores = draft ? deriveAbilityScores(draft) : {}

  const updateDraft = (updater: (current: CharacterAuthored) => CharacterAuthored) => {
    setDraft((current) => (current ? updater(current) : current))
  }

  const syncAncestrySelection = (optionId: string | null) => {
    updateDraft((current) =>
      cloneAndUpdateCharacter(current, (next) => {
        if (!selectedRaceDetail?.ancestry || !optionId) {
          next.intent.ancestrySelections = undefined
          return
        }

        next.intent.ancestrySelections = [{
          id: `${next.id}:ancestry:${optionId}`,
          ancestryId: selectedRaceDetail.ancestry.id,
          optionId,
          source: next.intent.race.subraceId
            ? { kind: 'SUBRACE', subraceId: next.intent.race.subraceId }
            : { kind: 'RACE', raceId: next.intent.race.raceId },
          timing: { kind: 'IMMEDIATE' }
        }]
      })
    )
  }

  const openSavePreview = async (target: 'draft' | 'active') => {
    if (!draft) return
    setPendingSaveTarget(target)
    await previewMutation.mutateAsync({
      character: draft,
      mode,
      targetStatus: target === 'active' ? AUTHORED_RECORD_STATUS.ACTIVE : AUTHORED_RECORD_STATUS.DRAFT
    })
    setPreviewOpen(true)
  }

  const confirmSave = async () => {
    if (!draft) return

    const payload = await upsertMutation.mutateAsync({
      character: draft,
      mode,
      targetStatus: pendingSaveTarget === 'active'
        ? AUTHORED_RECORD_STATUS.ACTIVE
        : AUTHORED_RECORD_STATUS.DRAFT
    })

    setDraft(payload.character)
    setLiveResolution(payload.resolution)
    setPreviewOpen(false)

    await navigate({
      to: '/characters/$characterId',
      params: { characterId: payload.character.id }
    })
  }

  const currentSectionIndex = findSectionIndex(sectionId)

  if (systemsQuery.isLoading || (isEditMode && builderQuery.isLoading) || (!isEditMode && !selectedSystemId)) {
    return (
      <Card radius='xl' p='xl' style={panelStyle}>
        <Text>Loading character builder...</Text>
      </Card>
    )
  }

  if (!draft || !liveResolution) {
    return (
      <Alert color='red' title='Builder Unavailable'>
        We could not load the character builder.
      </Alert>
    )
  }

  const previewLines = previewMutation.data?.preview.summaryLines ?? []

  return (
    <>
      <Stack gap='xl'>
        <Card radius='xl' p='xl' style={heroStyle}>
          <Stack gap='lg'>
            <Group justify='space-between' align='flex-start'>
              <Stack gap={8}>
                <Group gap='xs'>
                  <Sparkles size={18} />
                  <Text fw={700} tt='uppercase' size='xs' c='rgba(255,255,255,0.72)'>
                    {mode === 'edit' ? 'Edit Character' : 'Character Builder'}
                  </Text>
                </Group>
                <Title order={1} fz='clamp(2rem, 3vw, 3.1rem)'>
                  {draft.label || (mode === 'edit' ? 'Edit Character' : 'Build a New Character')}
                </Title>
                <Text size='lg' c='rgba(255,255,255,0.78)' maw={760}>
                  {sections[currentSectionIndex].description}
                </Text>
              </Stack>

              <Stack gap='sm' align='flex-end'>
                <Group gap='xs'>
                  <Badge color={draft.status === 'ACTIVE' ? 'green' : 'orange'} variant='light'>
                    {draft.status === 'ACTIVE' ? 'Playable' : 'Draft'}
                  </Badge>
                  <Badge variant='outline' c='white'>
                    Recommended: {liveResolution.recommendedSectionId}
                  </Badge>
                </Group>
                <Text c='rgba(255,255,255,0.72)' size='sm'>
                  Level {liveResolution.summary.totalLevel || 1}
                </Text>
              </Stack>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing='md'>
              <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
                <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Race</Text>
                <Text fw={700} mt={4}>{liveResolution.summary.selectedRace?.raceLabel ?? 'Not selected'}</Text>
                {liveResolution.summary.selectedRace?.ancestryOptionLabel ? (
                  <Text size='sm' c='rgba(255,255,255,0.72)'>
                    {liveResolution.summary.selectedRace.ancestryLabel}: {liveResolution.summary.selectedRace.ancestryOptionLabel}
                  </Text>
                ) : null}
              </Card>
              <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
                <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Class Structure</Text>
                <Text fw={700} mt={4}>
                  {liveResolution.summary.classes.length
                    ? liveResolution.summary.classes.map((entry) => entry.classLabel).join(', ')
                    : 'No classes yet'}
                </Text>
              </Card>
              <Card radius='lg' p='lg' style={{ background: 'rgba(255,255,255,0.08)' }}>
                <Text size='xs' tt='uppercase' c='rgba(255,255,255,0.68)'>Readiness</Text>
                <Text fw={700} mt={4}>
                  {liveResolution.readiness.ready ? 'Ready to save' : 'Needs structural work'}
                </Text>
                <Text size='sm' c='rgba(255,255,255,0.72)'>
                  {liveResolution.readiness.blockingIssues.length} blocking, {liveResolution.outstandingChoices.length} outstanding choices
                </Text>
              </Card>
            </SimpleGrid>
          </Stack>
        </Card>

        <Card radius='xl' p='xl' style={panelStyle}>
          <Stack gap='lg'>
            <SimpleGrid cols={{ base: 1, md: 3, xl: 5 }} spacing='sm'>
              {sections.map((section, index) => (
                <Button
                  key={section.id}
                  variant={section.id === sectionId ? 'filled' : 'default'}
                  radius='xl'
                  onClick={() => setSectionId(section.id)}
                  styles={{
                    root: section.id === sectionId
                      ? { background: 'linear-gradient(135deg, #c46d4f, #9f4b2b)' }
                      : undefined
                  }}
                >
                  {section.short} - {section.title}
                </Button>
              ))}
            </SimpleGrid>

            <Divider />

            {sectionId === 'BASICS' ? (
              <Stack gap='lg'>
                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
                  <TextInput
                    label='Name'
                    value={draft.label}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.label = event.currentTarget.value
                        })
                      )
                    }
                  />
                  <Select
                    label='System'
                    data={(systemsQuery.data ?? []).map((system) => ({
                      value: system.id,
                      label: system.label
                    }))}
                    value={draft.systemId}
                    disabled={isEditMode}
                    onChange={(value) => {
                      if (!value || isEditMode) return
                      setSelectedSystemId(value)
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.systemId = value
                        })
                      )
                    }}
                  />
                </SimpleGrid>

                <Textarea
                  label='Character Concept'
                  minRows={4}
                  value={draft.description ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.description = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />

                <Select
                  label='Advancement Method'
                  data={[
                    { value: 'MILESTONE', label: 'Milestone' },
                    { value: 'EXPERIENCE', label: 'Experience' }
                  ]}
                  value={draft.intent.advancement.method}
                  onChange={(value) => {
                    if (!value) return
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.intent.advancement = value === 'EXPERIENCE'
                          ? { method: 'EXPERIENCE', experience: next.intent.advancement.method === 'EXPERIENCE' ? next.intent.advancement.experience : 0 }
                          : { method: 'MILESTONE' }
                      })
                    )
                  }}
                />
              </Stack>
            ) : null}

            {sectionId === 'RACE' ? (
              <Stack gap='lg'>
                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
                  <Select
                    label='Race'
                    data={baseRaceDetails.map((detail) => ({
                      value: detail.id,
                      label: detail.label
                    }))}
                    value={draft.intent.race.raceId}
                    onChange={(value) => {
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.intent.race.raceId = value ?? ''
                          next.intent.race.subraceId = undefined
                          next.intent.ancestrySelections = undefined
                        })
                      )
                    }}
                  />

                  <Select
                    label='Subrace'
                    placeholder={selectedSubraceOptions.length ? 'Optional' : 'No subraces'}
                    disabled={selectedSubraceOptions.length === 0}
                    data={selectedSubraceOptions.map((detail) => ({
                      value: detail.id,
                      label: detail.label
                    }))}
                    value={draft.intent.race.subraceId ?? null}
                    onChange={(value) => {
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.intent.race.subraceId = value ?? undefined
                          next.intent.ancestrySelections = undefined
                        })
                      )
                    }}
                  />
                </SimpleGrid>

                {selectedRaceDetail?.ancestry ? (
                  <Select
                    label={selectedRaceDetail.ancestry.label}
                    data={selectedRaceDetail.ancestry.options.map((option) => ({
                      value: option.id,
                      label: option.label
                    }))}
                    value={draft.intent.ancestrySelections?.[0]?.optionId ?? null}
                    onChange={(value) => syncAncestrySelection(value)}
                  />
                ) : null}

                <Card radius='lg' p='lg' withBorder>
                  <Stack gap='sm'>
                    <Text fw={700}>Granted summary</Text>
                    <Text size='sm' c='dimmed'>
                      Race choices stay on this screen so ancestry and other source-local options do not drift into a separate selections page.
                    </Text>
                    {liveResolution.grants.features.length ? (
                      <Stack gap={6}>
                        {liveResolution.grants.features
                          .filter((item) => item.source.kind === 'RACE' || item.source.kind === 'SUBRACE' || item.source.kind === 'ANCESTRY')
                          .map((item) => (
                            <Text key={`${item.id}:${item.sourceLabel}`} size='sm'>
                              {item.label} - {item.sourceLabel}
                            </Text>
                          ))}
                      </Stack>
                    ) : (
                      <Text size='sm' c='dimmed'>No race grants yet.</Text>
                    )}
                  </Stack>
                </Card>
              </Stack>
            ) : null}

            {sectionId === 'CLASSES' ? (
              <Stack gap='lg'>
                {draft.intent.classes.map((entry, index) => {
                  const selectedClass = entry.classId ? classDetailMap[entry.classId] ?? null : null
                  const subclasses = classDetails.filter((detail) =>
                    detail.category === 'SUBCLASS' && detail.parentClassId === entry.classId
                  )
                  const selectedSubclass = entry.subclassId ? classDetailMap[entry.subclassId] ?? null : null
                  const optionData = classDetails
                    .filter((detail) => detail.category === 'BASE')
                    .map((detail) => {
                      const currentRowOwnsClass = detail.id === entry.classId
                      const alreadySelectedSomewhereElse = draft.intent.classes.some((candidate, candidateIndex) =>
                        candidateIndex !== index && candidate.classId === detail.id
                      )
                      const disabled = alreadySelectedSomewhereElse
                        || (
                          draft.intent.classes.length > 1
                          && !currentRowOwnsClass
                          && !meetsMulticlassRequirement(detail, abilityScores)
                        )

                      return {
                        value: detail.id,
                        label: detail.label,
                        disabled
                      }
                    })

                  return (
                    <Card key={`${index}:${entry.classId || 'empty'}`} radius='xl' p='xl' withBorder>
                      <Stack gap='lg'>
                        <Group justify='space-between' align='flex-start'>
                          <div>
                            <Text fw={800}>
                              {selectedClass?.label ?? `Class ${index + 1}`}
                            </Text>
                            <Text size='sm' c='dimmed'>
                              Invalid multiclass options remain visible but disabled before selection.
                            </Text>
                          </div>
                          <Button
                            variant='subtle'
                            color='red'
                            leftSection={<Trash2 size={16} />}
                            onClick={() =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  next.intent.classes.splice(index, 1)
                                })
                              )
                            }
                          >
                            Remove
                          </Button>
                        </Group>

                        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing='lg'>
                          <Select
                            label='Class'
                            data={optionData}
                            value={entry.classId}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  next.intent.classes[index] = {
                                    classId: value ?? '',
                                    classLevel: next.intent.classes[index]?.classLevel ?? 1
                                  }
                                })
                              )
                            }
                          />
                          <NumberInput
                            label='Class Level'
                            min={1}
                            max={20}
                            value={entry.classLevel}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  next.intent.classes[index].classLevel = Number(value) || 1
                                })
                              )
                            }
                          />
                          <Select
                            label='Subclass'
                            placeholder={subclasses.length ? 'Optional' : 'No subclasses'}
                            disabled={subclasses.length === 0}
                            data={subclasses.map((detail) => ({
                              value: detail.id,
                              label: detail.label
                            }))}
                            value={entry.subclassId ?? null}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  next.intent.classes[index].subclassId = value ?? undefined
                                  next.intent.classes[index].specializationId = undefined
                                })
                              )
                            }
                          />
                        </SimpleGrid>

                        {selectedSubclass?.category === 'SUBCLASS' && selectedSubclass.specializations?.length ? (
                          <Select
                            label='Specialization'
                            data={selectedSubclass.specializations.map((specialization) => ({
                              value: specialization.id,
                              label: specialization.label
                            }))}
                            value={entry.specializationId ?? null}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  next.intent.classes[index].specializationId = value ?? undefined
                                })
                              )
                            }
                          />
                        ) : null}

                        <Divider />

                        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing='lg'>
                          <Card radius='lg' p='lg' withBorder>
                            <Text fw={700} size='sm'>Overview</Text>
                            <Text size='sm' c='dimmed' mt='xs'>
                              {selectedClass?.description || 'Choose a class to see its structural overview.'}
                            </Text>
                          </Card>
                          <Card radius='lg' p='lg' withBorder>
                            <Text fw={700} size='sm'>Features</Text>
                            {liveResolution.summary.classes[index]?.featureLabels.length ? (
                              <Stack gap={6} mt='xs'>
                                {liveResolution.summary.classes[index].featureLabels.map((label) => (
                                  <Text key={label} size='sm'>{label}</Text>
                                ))}
                              </Stack>
                            ) : (
                              <Text size='sm' c='dimmed' mt='xs'>No class features granted yet.</Text>
                            )}
                          </Card>
                          <Card radius='lg' p='lg' withBorder>
                            <Text fw={700} size='sm'>Spells</Text>
                            {liveResolution.summary.classes[index]?.spellcastingLabels.length ? (
                              <Stack gap={6} mt='xs'>
                                {liveResolution.summary.classes[index].spellcastingLabels.map((label) => (
                                  <Text key={label} size='sm'>{label}</Text>
                                ))}
                              </Stack>
                            ) : (
                              <Text size='sm' c='dimmed' mt='xs'>No spellcasting for this class right now.</Text>
                            )}
                          </Card>
                        </SimpleGrid>
                      </Stack>
                    </Card>
                  )
                })}

                <Group>
                  <Button
                    leftSection={<Plus size={16} />}
                    radius='xl'
                    onClick={() =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.intent.classes.push({
                            classId: '',
                            classLevel: 1
                          })
                        })
                      )
                    }
                  >
                    Add Class
                  </Button>
                </Group>
              </Stack>
            ) : null}

            {sectionId === 'BACKGROUND' ? (
              <Stack gap='lg'>
                <Select
                  label='Background'
                  data={backgroundItems.map((item) => ({
                    value: item.id,
                    label: item.label
                  }))}
                  value={draft.intent.background.backgroundId}
                  onChange={(value) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.intent.background.backgroundId = value ?? ''
                      })
                    )
                  }
                />

                <Card radius='lg' p='lg' withBorder>
                  <Text fw={700}>Background summary</Text>
                  <Text size='sm' c='dimmed' mt='xs'>
                    {liveResolution.summary.selectedBackground?.label
                      ? `${liveResolution.summary.selectedBackground.label} is currently attached to the build.`
                      : 'Choose a background to ground proficiencies and story context.'}
                  </Text>
                </Card>
              </Stack>
            ) : null}

            {sectionId === 'DETAILS' ? (
              <Stack gap='lg'>
                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
                  <TextInput
                    label='Alignment'
                    value={draft.profile.alignmentId ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.alignmentId = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Lifestyle'
                    value={draft.profile.lifestyleId ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.lifestyleId = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Faith'
                    value={draft.profile.faith ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.faith = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Gender'
                    value={draft.profile.gender ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.gender = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Age'
                    value={draft.profile.age ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.age = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Eyes'
                    value={draft.profile.eyes ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.eyes = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Hair'
                    value={draft.profile.hair ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.hair = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Skin'
                    value={draft.profile.skin ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.skin = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Height'
                    value={draft.profile.height ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.height = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                  <TextInput
                    label='Weight'
                    value={draft.profile.weight ?? ''}
                    onChange={(event) =>
                      updateDraft((current) =>
                        cloneAndUpdateCharacter(current, (next) => {
                          next.profile.weight = normalizeOptionalText(event.currentTarget.value)
                        })
                      )
                    }
                  />
                </SimpleGrid>

                <Textarea
                  label='Physical Characteristics'
                  minRows={4}
                  value={draft.profile.physicalCharacteristics ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.physicalCharacteristics = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
              </Stack>
            ) : null}

            {sectionId === 'NOTES' ? (
              <Stack gap='lg'>
                <Textarea
                  label='Personality Traits'
                  minRows={3}
                  value={draft.profile.personalityTraits ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.personalityTraits = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Ideals'
                  minRows={3}
                  value={draft.profile.ideals ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.ideals = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Bonds'
                  minRows={3}
                  value={draft.profile.bonds ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.bonds = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Flaws'
                  minRows={3}
                  value={draft.profile.flaws ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.flaws = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Organizations'
                  minRows={2}
                  value={draft.profile.organizations ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.organizations = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Allies'
                  minRows={2}
                  value={draft.profile.allies ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.allies = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Enemies'
                  minRows={2}
                  value={draft.profile.enemies ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.enemies = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Backstory'
                  minRows={5}
                  value={draft.profile.backstory ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.backstory = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
                <Textarea
                  label='Notes'
                  minRows={5}
                  value={draft.profile.notes ?? ''}
                  onChange={(event) =>
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.profile.notes = normalizeOptionalText(event.currentTarget.value)
                      })
                    )
                  }
                />
              </Stack>
            ) : null}

            {sectionId === 'ABILITIES' ? (
              <Stack gap='lg'>
                <Select
                  label='Ability Method'
                  data={[
                    { value: 'STANDARD_ARRAY', label: 'Standard Array' },
                    { value: 'POINT_BUY', label: 'Point Buy' },
                    { value: 'MANUAL_ROLLED', label: 'Manual Rolled' }
                  ]}
                  value={draft.intent.abilities.method}
                  onChange={(value) => {
                    if (!value) return

                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        if (value === 'MANUAL_ROLLED') {
                          next.intent.abilities = {
                            method: 'MANUAL_ROLLED',
                            state: {
                              assignments: abilityKeys.map((ability) => ({
                                ability,
                                score: Number(abilityScores[ability] ?? 8)
                              }))
                            }
                          }
                          return
                        }

                        next.intent.abilities = {
                          method: value,
                          assignments: abilityKeys.map((ability) => ({
                            ability,
                            option: String(abilityScores[ability] ?? (value === 'STANDARD_ARRAY' ? standardArrayOptions[0] : pointBuyOptions[0])) as '8'
                          }))
                        }
                      })
                    )
                  }}
                />

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
                  {draft.intent.abilities.method === 'MANUAL_ROLLED'
                    ? abilityKeys.map((ability) => {
                        const score = draft.intent.abilities.state.assignments.find((assignment) => assignment.ability === ability)?.score ?? 8
                        return (
                          <NumberInput
                            key={ability}
                            label={abilityLabels[ability]}
                            min={1}
                            max={30}
                            value={score}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  const existing = next.intent.abilities.method === 'MANUAL_ROLLED'
                                    ? next.intent.abilities.state.assignments.find((assignment) => assignment.ability === ability)
                                    : null
                                  if (existing) {
                                    existing.score = Number(value) || 8
                                  }
                                })
                              )
                            }
                          />
                        )
                      })
                    : abilityKeys.map((ability) => {
                        const assignments = draft.intent.abilities.assignments
                        const selectedValue = assignments.find((assignment) => assignment.ability === ability)?.option ?? ''
                        const allowedOptions = draft.intent.abilities.method === 'STANDARD_ARRAY'
                          ? standardArrayOptions
                          : pointBuyOptions

                        return (
                          <Select
                            key={ability}
                            label={abilityLabels[ability]}
                            data={allowedOptions.map((option) => ({
                              value: option,
                              label: option,
                              disabled: draft.intent.abilities.method === 'STANDARD_ARRAY'
                                ? assignments.some((assignment) => assignment.ability !== ability && assignment.option === option)
                                : false
                            }))}
                            value={selectedValue}
                            onChange={(value) =>
                              updateDraft((current) =>
                                cloneAndUpdateCharacter(current, (next) => {
                                  if (next.intent.abilities.method === 'MANUAL_ROLLED') return
                                  const existing = next.intent.abilities.assignments.find((assignment) => assignment.ability === ability)
                                  if (existing) {
                                    existing.option = (value ?? allowedOptions[0]) as typeof existing.option
                                  } else {
                                    next.intent.abilities.assignments.push({
                                      ability,
                                      option: (value ?? allowedOptions[0]) as '8'
                                    })
                                  }
                                })
                              )
                            }
                          />
                        )
                      })}
                </SimpleGrid>

                <Divider />

                <Select
                  label='Hit Point Method'
                  data={[
                    { value: 'FIXED', label: 'Fixed' },
                    { value: 'MANUAL', label: 'Manual' }
                  ]}
                  value={draft.intent.hitpoints.method}
                  onChange={(value) => {
                    if (!value) return
                    updateDraft((current) =>
                      cloneAndUpdateCharacter(current, (next) => {
                        next.intent.hitpoints.method = value
                      })
                    )
                  }}
                />

                <SimpleGrid cols={{ base: 1, lg: 3 }} spacing='lg'>
                  {draft.intent.hitpoints.levels.map((entry) => (
                    <NumberInput
                      key={entry.level}
                      label={`Level ${entry.level} Hit Points`}
                      min={1}
                      value={entry.value}
                      onChange={(value) =>
                        updateDraft((current) =>
                          cloneAndUpdateCharacter(current, (next) => {
                            const hitpointEntry = next.intent.hitpoints.levels.find((level) => level.level === entry.level)
                            if (hitpointEntry) {
                              hitpointEntry.value = Number(value) || 1
                            }
                          })
                        )
                      }
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            ) : null}

            {sectionId === 'EQUIPMENT' ? (
              <Stack gap='lg'>
                <Card radius='lg' p='lg' withBorder>
                  <Stack gap='sm'>
                    <Text fw={700}>Inventory snapshot</Text>
                    <Text size='sm' c='dimmed'>
                      Equipment and currency are sheet-facing play state, but the builder still owns the structural starting choices that grant them.
                    </Text>
                    <Text size='sm'>Inventory items: {draft.state.equipment.inventory.length}</Text>
                    <Text size='sm'>Equipped: {draft.state.equipment.equipped.length}</Text>
                    <Text size='sm'>Attuned: {draft.state.equipment.attuned.length}</Text>
                    <Text size='sm'>Currency groups: {draft.state.currency.length}</Text>
                  </Stack>
                </Card>

                {renderIssueList(
                  'Outstanding equipment choices',
                  liveResolution.outstandingChoices
                    .filter((choice) => choice.code === 'CLASS_STARTING_EQUIPMENT_REQUIRED' || choice.code === 'BACKGROUND_STARTING_EQUIPMENT_REQUIRED')
                    .map((choice) => choice.message),
                  'yellow'
                )}
              </Stack>
            ) : null}

            {sectionId === 'REVIEW' ? (
              <Stack gap='lg'>
                {renderIssueList('Blocking issues', liveResolution.readiness.blockingIssues, 'orange')}
                {renderIssueList('Required choices', liveResolution.readiness.outstandingRequiredChoices, 'yellow')}
                {renderIssueList(
                  'Warnings',
                  liveResolution.validations
                    .filter((validation) => validation.severity === 'warning')
                    .map((validation) => validation.message),
                  'blue'
                )}

                <Card radius='lg' p='lg' withBorder>
                  <Stack gap='sm'>
                    <Text fw={700}>Current build snapshot</Text>
                    <Text size='sm'>Race: {liveResolution.summary.selectedRace?.raceLabel ?? 'Not selected'}</Text>
                    <Text size='sm'>Background: {liveResolution.summary.selectedBackground?.label ?? 'Not selected'}</Text>
                    <Text size='sm'>
                      Classes: {liveResolution.summary.classes.length
                        ? liveResolution.summary.classes.map((entry) => `${entry.classLabel} ${entry.classLevel}`).join(', ')
                        : 'None'}
                    </Text>
                  </Stack>
                </Card>

                <Group>
                  <Button
                    radius='xl'
                    variant='default'
                    onClick={() => openSavePreview('draft')}
                    loading={previewMutation.isPending && pendingSaveTarget === 'draft'}
                  >
                    Save Draft
                  </Button>
                  <Button
                    radius='xl'
                    rightSection={<ArrowRight size={16} />}
                    onClick={() => openSavePreview('active')}
                    loading={previewMutation.isPending && pendingSaveTarget === 'active'}
                  >
                    Save and Open Sheet
                  </Button>
                </Group>
              </Stack>
            ) : null}
          </Stack>
        </Card>

        {sectionId !== 'REVIEW'
          ? renderIssueList(
              'Current builder guidance',
              [
                ...liveResolution.readiness.blockingIssues,
                ...liveResolution.outstandingChoices.map((choice) => choice.message)
              ],
              'yellow'
            )
          : null}

        <Group justify='space-between'>
          <Button
            radius='xl'
            variant='default'
            leftSection={<ArrowLeft size={16} />}
            disabled={currentSectionIndex === 0}
            onClick={() => setSectionId(sections[Math.max(currentSectionIndex - 1, 0)].id)}
          >
            Previous
          </Button>

          <Button
            radius='xl'
            rightSection={<ArrowRight size={16} />}
            disabled={currentSectionIndex === sections.length - 1}
            onClick={() => setSectionId(sections[Math.min(currentSectionIndex + 1, sections.length - 1)].id)}
          >
            Next
          </Button>
        </Group>
      </Stack>

      <Modal
        opened={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title='Save preview'
        centered
        radius='xl'
      >
        <Stack gap='md'>
          <Alert color='blue' icon={<CircleAlert size={16} />} title='Plain-language consequences'>
            <Stack gap={6}>
              {previewLines.length > 0 ? (
                previewLines.map((line) => (
                  <Text key={line} size='sm'>{line}</Text>
                ))
              ) : (
                <Text size='sm'>No destructive downstream changes are predicted for this save.</Text>
              )}
            </Stack>
          </Alert>

          <Text size='sm' c='dimmed'>
            {pendingSaveTarget === 'active'
              ? 'This will try to keep the character playable. Incomplete builds still fall back to Draft.'
              : 'This will save the character in Draft so you can keep iterating in the builder.'}
          </Text>

          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmSave()} loading={upsertMutation.isPending}>
              Confirm Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}

export default CharacterForm
