import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createBackgroundRepository,
  createClassRepository,
  createEquipmentRepository,
  createRaceRepository,
  createSystemRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  type CharacterBuilderChosenGrantChoiceViewDto,
  type CharacterBuilderFeatureChoiceViewDto,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderSpellChoiceViewDto,
  type CharacterBuilderStartingEquipmentViewDto
} from '@artificer-toolkit/schema/api/characters'
import { ABILITY_CODE, AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterAuthored,
  type CharacterStartingEquipmentDecision
} from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from '../services/character/builderService.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

type CharacterStartingEquipmentView = NonNullable<CharacterBuilderStartingEquipmentViewDto>
export function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'DATABASE_CONNECTION_STRING is required for the Character lifecycle integration proof.'
    )
  }

  let host: string
  try {
    host = new URL(connectionString).hostname.toLowerCase()
  } catch {
    throw new Error(
      'The Character lifecycle integration proof requires a URL-shaped Postgres connection string.'
    )
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the Character lifecycle integration proof against non-local database host "${host}".`
    )
  }

  return connectionString
}

export function requireRecordByLabel<T extends { label: string }>(
  records: readonly T[],
  label: string,
  kind: string
): T {
  const matches = records.filter((record) => record.label === label)
  assert.equal(matches.length, 1, `Expected exactly one seeded ${kind} named "${label}".`)
  return matches[0] as T
}

interface CharacterLifecycleFixtureCatalog {
  backgroundId: string
  championId: string
  clericId: string
  dragonbornId: string
  fighterId: string
  humanId: string
  lifeDomainId: string
  rogueId: string
  systemId: string
  userId: string
}

export async function findFixtureCatalog(db: DBLike): Promise<CharacterLifecycleFixtureCatalog> {
  const systems = await createSystemRepository(db).findAll()
  const matchingSystems = systems.filter(
    (system) => system.rulesetCode === 'dnd5e' && system.rulesetVersion === '2014'
  )
  assert.equal(
    matchingSystems.length,
    1,
    'Expected exactly one seeded D&D 5e 2014 system. Run `yarn seed:srd:local` first.'
  )
  const system = matchingSystems[0]
  assert.ok(system, 'The seeded D&D 5e 2014 system is missing.')
  assert.ok(system.userId, 'The seeded D&D 5e 2014 system has no owning user.')

  const [races, classes, backgrounds] = await Promise.all([
    createRaceRepository(db).findResolvedAll({ systemId: system.id }),
    createClassRepository(db).findAll({ systemId: system.id }),
    createBackgroundRepository(db).findAll({ systemId: system.id })
  ])

  return {
    backgroundId: requireRecordByLabel(backgrounds, 'Acolyte', 'background').id,
    championId: requireRecordByLabel(classes, 'Champion', 'subclass').id,
    clericId: requireRecordByLabel(classes, 'Cleric', 'class').id,
    dragonbornId: requireRecordByLabel(races, 'Dragonborn', 'race').id,
    fighterId: requireRecordByLabel(classes, 'Fighter', 'class').id,
    humanId: requireRecordByLabel(races, 'Human', 'race').id,
    lifeDomainId: requireRecordByLabel(classes, 'Life Domain', 'subclass').id,
    rogueId: requireRecordByLabel(classes, 'Rogue', 'class').id,
    systemId: system.id,
    userId: system.userId
  }
}

export async function createAttunementEquipmentFixture(
  db: DBLike,
  catalog: CharacterLifecycleFixtureCatalog,
  equipmentId: string
): Promise<void> {
  const repository = createEquipmentRepository(db)
  const equipment = await repository.findAll({
    systemId: catalog.systemId,
    userId: catalog.userId
  })
  const source = requireRecordByLabel(equipment, 'Club', 'equipment')
  if (source.category === 'VARIANT') {
    throw new Error('The seeded Club must be base equipment for the Sheet command fixture.')
  }
  if (!source.weight) {
    throw new Error('The seeded Club must have weight for the Sheet command fixture.')
  }

  await repository.upsert({
    kind: source.kind,
    id: equipmentId,
    label: 'ZZZ Lifecycle Attunement Club',
    description: 'Transaction-local equipment used to prove Sheet attunement persistence.',
    status: AUTHORED_RECORD_STATUS.ACTIVE,
    category: source.category,
    properties: [...source.properties],
    weight: { ...source.weight },
    rarityId: source.rarityId,
    requiresAttunement: true,
    userId: catalog.userId,
    systemId: catalog.systemId
  })
}

interface CharacterLifecycleClassFixture {
  classId: string
  classLabel: string
  classLevel: number
  subclassId?: string
  subclassLabel?: string
}

interface CharacterLifecycleHitpointLevelFixture {
  classId: string
  classLevel: number
  level: number
  value: number
}

interface CharacterLifecycleHitDieFixture {
  die: number
  total: number
  used: number
}

export interface CharacterLifecycleFixture {
  backgroundId: string
  characterId: string
  classes: CharacterLifecycleClassFixture[]
  expectedMaxHitPoints: number
  hitDice?: CharacterLifecycleHitDieFixture[]
  hitpointLevels: CharacterLifecycleHitpointLevelFixture[]
  label: string
  preparedCasterClassId?: string
  raceId: string
  raceLabel: string
  systemId: string
  userId: string
}

export interface BuilderResolutionTiming {
  durationMs: number
  fixture: string
  stage: 'initial' | 'structural' | 'completed' | 'reloaded'
}

export async function measureBuilderResolution<T>(
  timings: BuilderResolutionTiming[],
  fixture: CharacterLifecycleFixture,
  stage: BuilderResolutionTiming['stage'],
  resolve: () => Promise<T>
): Promise<T> {
  console.info(
    JSON.stringify({
      builderResolutionStart: {
        fixture: fixture.label,
        stage
      }
    })
  )
  const startedAt = Date.now()
  const result = await resolve()
  const timing: BuilderResolutionTiming = {
    durationMs: Date.now() - startedAt,
    fixture: fixture.label,
    stage
  }
  timings.push(timing)
  console.info(JSON.stringify({ builderResolutionTiming: timing }))
  return result
}

export function percentileDuration(
  timings: readonly BuilderResolutionTiming[],
  percentile: number
): number {
  const durations = timings.map(({ durationMs }) => durationMs).sort((left, right) => left - right)
  if (durations.length === 0) return 0

  const index = Math.max(0, Math.ceil(percentile * durations.length) - 1)
  return durations[index] ?? 0
}

export function expectedClassSummary(fixture: CharacterLifecycleFixture): string {
  return fixture.classes
    .map((classFixture) => {
      const subclass = classFixture.subclassLabel ? ` (${classFixture.subclassLabel})` : ''
      return `${classFixture.classLabel}${subclass} ${classFixture.classLevel}`
    })
    .join(' / ')
}

export function expectedTotalLevel(fixture: CharacterLifecycleFixture): number {
  return fixture.classes.reduce((total, classFixture) => total + classFixture.classLevel, 0)
}

export function assertCharacterProgression(
  character: CharacterAuthored,
  fixture: CharacterLifecycleFixture,
  stage: string,
  expectSubclasses = true
): void {
  assert.deepEqual(
    character.intent.classes.map(({ classId, classLevel, subclassId }) => ({
      classId,
      classLevel,
      ...(subclassId ? { subclassId } : {})
    })),
    fixture.classes.map(({ classId, classLevel, subclassId }) => ({
      classId,
      classLevel,
      ...(expectSubclasses && subclassId ? { subclassId } : {})
    })),
    `${fixture.label} ${stage} did not preserve its ordered class progression.`
  )
  assert.deepEqual(
    character.intent.hitpoints.levels.map(({ level, classId, classLevel, value }) => ({
      level,
      classId,
      classLevel,
      value
    })),
    fixture.hitpointLevels,
    `${fixture.label} ${stage} did not preserve its ordered hit point progression.`
  )
}

export function assertResolvedClassLevels(
  resolution: CharacterBuilderPayloadDto['resolution'],
  fixture: CharacterLifecycleFixture,
  stage: string
): void {
  assert.equal(
    resolution.summary.totalLevel,
    expectedTotalLevel(fixture),
    `${fixture.label} ${stage} resolved the wrong total level.`
  )
  assert.deepEqual(
    resolution.summary.classes.map(({ classId, classLevel }) => ({ classId, classLevel })),
    fixture.classes.map(({ classId, classLevel }) => ({ classId, classLevel })),
    `${fixture.label} ${stage} resolved the wrong class levels.`
  )
}

export function createFixtureCharacter(params: CharacterLifecycleFixture): CharacterAuthored {
  const character = createEmptyCharacterAuthored({
    id: params.characterId,
    systemId: params.systemId,
    userId: params.userId
  })
  assert.equal(
    params.hitpointLevels.length,
    expectedTotalLevel(params),
    `${params.label} fixture needs one hit point row per character level.`
  )
  assert.equal(
    params.hitpointLevels.reduce((total, level) => total + level.value, 0),
    params.expectedMaxHitPoints,
    `${params.label} fixture hit point rows do not total its expected max hit points.`
  )

  return {
    ...character,
    label: params.label,
    intent: {
      ...character.intent,
      race: { raceId: params.raceId },
      background: { backgroundId: params.backgroundId },
      classes: params.classes.map(({ classId, classLevel }) => ({ classId, classLevel })),
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [
          { ability: ABILITY_CODE.STRENGTH, option: '15' },
          { ability: ABILITY_CODE.DEXTERITY, option: '14' },
          { ability: ABILITY_CODE.CONSTITUTION, option: '13' },
          { ability: ABILITY_CODE.INTELLIGENCE, option: '12' },
          { ability: ABILITY_CODE.WISDOM, option: '10' },
          { ability: ABILITY_CODE.CHARISMA, option: '8' }
        ]
      },
      hitpoints: {
        method: 'FIXED',
        levels: params.hitpointLevels
      }
    },
    state: {
      ...character.state,
      hitpoints: {
        current: params.expectedMaxHitPoints,
        hitDice: params.hitDice ?? []
      }
    }
  }
}

function preferredGrantLabels(choice: CharacterBuilderChosenGrantChoiceViewDto): string[] {
  if (choice.label === 'Skill Proficiencies') return ['Athletics', 'Perception']
  if (choice.label === 'Languages' && choice.source.kind === 'RACE') return ['Elvish']
  if (choice.label === 'Languages' && choice.source.kind === 'BACKGROUND') {
    return ['Celestial', 'Infernal']
  }

  return []
}

export function chooseGrantTargets(
  choice: CharacterBuilderChosenGrantChoiceViewDto,
  unavailableTargetIds: ReadonlySet<string> = new Set()
): string[] {
  const preferredLabels = preferredGrantLabels(choice)
  const preferredIds = preferredLabels.flatMap((label) => {
    const option = choice.options.find(
      (candidate) =>
        candidate.label === label && !candidate.disabled && !unavailableTargetIds.has(candidate.id)
    )
    return option ? [option.id] : []
  })
  const fallbackIds = choice.options
    .filter((option) => !option.disabled && !unavailableTargetIds.has(option.id))
    .map((option) => option.id)
    .filter((id) => !preferredIds.includes(id))
  const targetIds = [...preferredIds, ...fallbackIds].slice(0, choice.requiredCount)

  assert.equal(
    targetIds.length,
    choice.requiredCount,
    `${choice.sourceLabel} ${choice.label} does not expose enough selectable targets.`
  )
  if (choice.duplicatePolicy === 'UNIQUE') {
    assert.equal(
      new Set(targetIds).size,
      targetIds.length,
      `${choice.sourceLabel} ${choice.label} produced duplicate targets.`
    )
  }

  return targetIds
}

function allGrantChoices(payload: CharacterBuilderPayloadDto) {
  return [
    ...payload.view.race.grantChoices,
    ...payload.view.classes.selectedClasses.flatMap((classView) => classView.grantChoices),
    ...payload.view.background.grantChoices
  ]
}

function allFeatureChoices(payload: CharacterBuilderPayloadDto) {
  return [
    ...payload.view.race.featureChoices,
    ...payload.view.classes.selectedClasses.flatMap((classView) => classView.featureChoices),
    ...payload.view.background.featureChoices
  ]
}

export function allSpellChoices(
  payload: CharacterBuilderPayloadDto
): CharacterBuilderSpellChoiceViewDto[] {
  return payload.view.classes.selectedClasses.flatMap((classView) => classView.spellChoices)
}

export function applyStructuralChoices(
  character: CharacterAuthored,
  payload: CharacterBuilderPayloadDto,
  fixture: CharacterLifecycleFixture
): CharacterAuthored {
  const nextCharacter = structuredClone(character)
  const ancestry = payload.view.race.ancestry
  if (ancestry) {
    const option = ancestry.options[0]
    assert.ok(option, `${fixture.raceLabel} does not expose an ancestry option.`)
    nextCharacter.intent.ancestrySelections = [
      {
        id: randomUUID(),
        ancestryId: ancestry.ancestryId,
        optionId: option.id,
        source: { kind: 'RACE', raceId: fixture.raceId },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
  }

  for (const classFixture of fixture.classes.filter(({ subclassId }) => subclassId)) {
    const classView = payload.view.classes.selectedClasses.find(
      (candidate) => candidate.classId === classFixture.classId
    )
    assert.ok(classView, `${classFixture.classLabel} is missing from the resolved Builder view.`)
    const eligibleSubclass = classView.subclassOptions.find(
      (candidate) => candidate.id === classFixture.subclassId
    )
    assert.ok(
      eligibleSubclass,
      `${classFixture.subclassLabel ?? classFixture.subclassId} is not eligible for ${classFixture.classLabel} ${classFixture.classLevel}.`
    )
    nextCharacter.intent.classes = nextCharacter.intent.classes.map((classIntent) =>
      classIntent.classId === classFixture.classId
        ? { ...classIntent, subclassId: classFixture.subclassId }
        : classIntent
    )
  }

  return nextCharacter
}

export function chooseSpellSelections(
  choices: readonly CharacterBuilderSpellChoiceViewDto[]
): NonNullable<CharacterAuthored['intent']['spellSelections']> {
  return choices.map((choice) => {
    assert.ok(
      choice.source.kind === 'CLASS' || choice.source.kind === 'SUBCLASS',
      `${choice.sourceLabel} exposed an unsupported Builder spell source.`
    )
    const cantripIds = choice.cantripOptions
      .slice(0, choice.cantripLimit)
      .map((option) => option.id)
    const spellIds = choice.spellOptions
      .slice(0, choice.learnedSpellLimit)
      .map((option) => option.id)
    assert.equal(
      cantripIds.length,
      choice.cantripLimit,
      `${choice.sourceLabel} does not expose enough cantrips.`
    )
    assert.equal(
      spellIds.length,
      choice.learnedSpellLimit,
      `${choice.sourceLabel} does not expose enough learned spells.`
    )

    return {
      id: randomUUID(),
      source: choice.source,
      timing:
        choice.source.kind === 'CLASS'
          ? {
              kind: 'CLASS_LEVEL' as const,
              classId: choice.source.classId,
              classLevel: choice.source.classLevel ?? 1
            }
          : { kind: 'IMMEDIATE' as const },
      spells: [...cantripIds, ...spellIds]
    }
  })
}

export function getFeatureChoiceTiming(
  source: CharacterBuilderFeatureChoiceViewDto['source']
): CharacterAuthored['intent']['featureAcquisitions'][number]['timing'] {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: source.classLevel ?? 1
    }
  }

  return { kind: 'IMMEDIATE' }
}

export function chooseFeatureOption(choice: CharacterBuilderFeatureChoiceViewDto): string[] {
  const preferred =
    choice.featureLabel === 'Fighting Style'
      ? choice.options.find((option) => option.label === 'Defense')
      : undefined
  const optionIds = [
    ...(preferred ? [preferred.id] : []),
    ...choice.options.map((option) => option.id).filter((id) => id !== preferred?.id)
  ].slice(0, choice.requiredCount)

  assert.equal(
    optionIds.length,
    choice.requiredCount,
    `${choice.sourceLabel} ${choice.featureLabel} does not expose enough feature options.`
  )
  return optionIds
}

export function buildStartingEquipmentDecision(
  view: CharacterStartingEquipmentView,
  equipmentOptions: CharacterBuilderPayloadDto['view']['equipment']['equipmentOptions']
): CharacterStartingEquipmentDecision {
  const source =
    view.source === 'CLASS'
      ? CharacterStartingEquipmentSource.CLASS
      : CharacterStartingEquipmentSource.BACKGROUND

  return {
    source,
    tookGold: false,
    groups: view.startingEquipment.sets
      .flatMap((set) => set.groups)
      .map((group) => {
        const option = group.options[0]
        assert.ok(
          option,
          `${view.sourceLabel} starting equipment group "${group.id}" has no option.`
        )

        const selections = option.items.flatMap((item) => {
          if (item.startingEquipmentKind !== 'EQUIPMENT' || item.selectionKind !== 'CHOSEN') {
            return []
          }

          const allowedIds = 'equipmentIds' in item ? new Set(item.equipmentIds) : null
          const candidates = equipmentOptions.filter(
            (candidate) =>
              (!allowedIds || allowedIds.has(candidate.id)) &&
              (!item.category || candidate.category === item.category) &&
              (!item.properties?.length ||
                item.properties.every((property) => candidate.properties?.includes(property)))
          )
          const selected =
            candidates.find((candidate) => candidate.label === 'Prayer Book') ?? candidates[0]
          assert.ok(
            selected,
            `${view.sourceLabel} starting equipment item "${item.id}" has no eligible equipment.`
          )

          return [
            {
              selectionKey: item.id,
              equipmentId: selected.id,
              quantity: item.count
            }
          ]
        })

        return {
          groupId: group.id,
          optionId: option.id,
          selections
        }
      })
  }
}

export function completeBuilderChoices(
  character: CharacterAuthored,
  payload: CharacterBuilderPayloadDto
): CharacterAuthored {
  const grantChoices = allGrantChoices(payload)
  const featureChoices = allFeatureChoices(payload)
  const spellChoices = allSpellChoices(payload)

  const classStartingEquipment = payload.view.equipment.classStartingEquipment
  const backgroundStartingEquipment = payload.view.equipment.backgroundStartingEquipment
  assert.ok(backgroundStartingEquipment, 'Seeded Acolyte should expose starting equipment choices.')
  const selectedFullProficiencies = new Map<string, Set<string>>()
  const chosenGrantSelections = grantChoices.map((choice) => {
    const selectedForKind =
      choice.proficiencyLevel === 'FULL' && choice.proficiencyKind
        ? (selectedFullProficiencies.get(choice.proficiencyKind) ?? new Set<string>())
        : new Set<string>()
    const targetIds = chooseGrantTargets(choice, selectedForKind)
    if (choice.proficiencyLevel === 'FULL' && choice.proficiencyKind) {
      for (const targetId of targetIds) selectedForKind.add(targetId)
      selectedFullProficiencies.set(choice.proficiencyKind, selectedForKind)
    }

    return {
      id: randomUUID(),
      grantId: choice.grantId,
      source: choice.source,
      timing: choice.timing,
      progressionLevel: choice.progressionLevel,
      targetIds
    }
  })
  const startingEquipment: NonNullable<CharacterAuthored['intent']['startingEquipment']> = {
    class: classStartingEquipment
      ? buildStartingEquipmentDecision(
          classStartingEquipment,
          payload.view.equipment.equipmentOptions
        )
      : undefined,
    background: buildStartingEquipmentDecision(
      backgroundStartingEquipment,
      payload.view.equipment.equipmentOptions
    )
  }

  return {
    ...character,
    intent: {
      ...character.intent,
      chosenGrantSelections,
      featureAcquisitions: featureChoices.map((choice) => {
        const optionIds = chooseFeatureOption(choice)
        return {
          id: randomUUID(),
          featureId: choice.featureId,
          source: choice.source,
          timing: getFeatureChoiceTiming(choice.source),
          selections: [
            {
              selectionKey: choice.selectionKey,
              values:
                optionIds.length === 1
                  ? [{ kind: 'ID' as const, id: optionIds[0] as string }]
                  : [{ kind: 'IDS' as const, ids: optionIds }]
            }
          ]
        }
      }),
      spellSelections: spellChoices.length > 0 ? chooseSpellSelections(spellChoices) : undefined,
      startingEquipment
    }
  }
}
