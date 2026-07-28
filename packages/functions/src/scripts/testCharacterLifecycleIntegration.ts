import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createBackgroundRepository,
  createCharacterRepository,
  createClassRepository,
  createDb,
  createEquipmentRepository,
  createRaceRepository,
  createSystemRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  characterBuilderDraftPayloadDtoSchema,
  type CharacterBuilderChosenGrantChoiceViewDto,
  type CharacterBuilderFeatureChoiceViewDto,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderSpellChoiceViewDto,
  type CharacterBuilderStartingEquipmentViewDto,
  type CharacterSheetCommandInputDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { ABILITY_CODE, AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterAuthored,
  type CharacterStartingEquipmentDecision
} from '@artificer-toolkit/shared/subjects/authored'
import { createEmptyCharacterAuthored } from '../services/character/builderService.js'
import {
  getCharacterBuilderDraftForUser,
  getCharacterSheetForUser,
  dispatchCommandForUser,
  getCharacterHistoryForUser,
  previewCharacterRestForUser,
  previewCharacterSaveForUser,
  resolveCharacterForUser,
  saveCharacterBuilderDraftForUser,
  upsertCharacterBuilderForUser
} from '../services/character/characterApplicationService.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

type CharacterStartingEquipmentView = NonNullable<CharacterBuilderStartingEquipmentViewDto>
type CharacterSheetCommandPayload = CharacterSheetCommandInputDto extends infer Command
  ? Command extends CharacterSheetCommandInputDto
    ? Omit<Command, 'commandId' | 'expectedVersion'>
    : never
  : never

function requireLocalDatabaseUrl(): string {
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

function requireRecordByLabel<T extends { label: string }>(
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

async function findFixtureCatalog(db: DBLike): Promise<CharacterLifecycleFixtureCatalog> {
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

async function createAttunementEquipmentFixture(
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

interface CharacterLifecycleFixture {
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

interface BuilderResolutionTiming {
  durationMs: number
  fixture: string
  stage: 'initial' | 'structural' | 'completed' | 'reloaded'
}

async function measureBuilderResolution<T>(
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

function percentileDuration(
  timings: readonly BuilderResolutionTiming[],
  percentile: number
): number {
  const durations = timings.map(({ durationMs }) => durationMs).sort((left, right) => left - right)
  if (durations.length === 0) return 0

  const index = Math.max(0, Math.ceil(percentile * durations.length) - 1)
  return durations[index] ?? 0
}

function expectedClassSummary(fixture: CharacterLifecycleFixture): string {
  return fixture.classes
    .map((classFixture) => {
      const subclass = classFixture.subclassLabel ? ` (${classFixture.subclassLabel})` : ''
      return `${classFixture.classLabel}${subclass} ${classFixture.classLevel}`
    })
    .join(' / ')
}

function expectedTotalLevel(fixture: CharacterLifecycleFixture): number {
  return fixture.classes.reduce((total, classFixture) => total + classFixture.classLevel, 0)
}

function assertCharacterProgression(
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

function assertResolvedClassLevels(
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

function createFixtureCharacter(params: CharacterLifecycleFixture): CharacterAuthored {
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

function chooseGrantTargets(
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

function allSpellChoices(
  payload: CharacterBuilderPayloadDto
): CharacterBuilderSpellChoiceViewDto[] {
  return payload.view.classes.selectedClasses.flatMap((classView) => classView.spellChoices)
}

function applyStructuralChoices(
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

function chooseSpellSelections(
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

function getFeatureChoiceTiming(
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

function chooseFeatureOption(choice: CharacterBuilderFeatureChoiceViewDto): string[] {
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

function buildStartingEquipmentDecision(
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

function completeBuilderChoices(
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

function canonicalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

async function dispatchAndReloadSheetCommand(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto,
  payload: CharacterSheetCommandPayload
): Promise<CharacterSheetResponseDto> {
  const command = {
    ...payload,
    commandId: randomUUID(),
    expectedVersion: sheet.meta.streamVersion
  } as CharacterSheetCommandInputDto
  const result = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId)
  assert.equal(
    result.streamVersion,
    sheet.meta.streamVersion + 1,
    `${fixture.label} ${payload.type} did not advance the stream exactly once.`
  )

  const reloaded = await getCharacterSheetForUser(db, fixture.characterId)
  assert.ok(reloaded, `${fixture.label} could not be reloaded after ${payload.type}.`)
  assert.deepEqual(
    canonicalize(reloaded),
    canonicalize(result.sheet),
    `${fixture.label} ${payload.type} response did not match its persisted Sheet reload.`
  )
  console.info(
    JSON.stringify({
      command: payload.type,
      fixture: fixture.label,
      persistedReload: 'verified'
    })
  )

  return reloaded
}

async function assertFixtureWasRolledBack(
  db: ReturnType<typeof createDb>,
  characterId: string
): Promise<void> {
  const [characters, drafts, events, routeIds] = await Promise.all([
    db.selectFrom('characters').select('id').where('id', '=', characterId).execute(),
    db
      .selectFrom('character_builder_drafts')
      .select('id')
      .where('character_id', '=', characterId)
      .execute(),
    db
      .selectFrom('character_events')
      .select('event_id')
      .where('character_id', '=', characterId)
      .execute(),
    db
      .selectFrom('authored_route_ids')
      .select('subject_id')
      .where('subject_kind', '=', 'CHARACTER')
      .where('subject_id', '=', characterId)
      .execute()
  ])

  assert.deepEqual(characters, [], 'The finalized Character escaped its rollback transaction.')
  assert.deepEqual(drafts, [], 'The Character Builder draft escaped its rollback transaction.')
  assert.deepEqual(
    events,
    [],
    'The Character Sheet command events escaped their rollback transaction.'
  )
  assert.deepEqual(
    routeIds,
    [],
    'The Character public route identity escaped its rollback transaction.'
  )
}

async function assertCommandEquipmentWasRolledBack(
  db: ReturnType<typeof createDb>,
  equipmentId: string
): Promise<void> {
  const equipment = await db
    .selectFrom('equipment')
    .select('id')
    .where('id', '=', equipmentId)
    .execute()
  assert.deepEqual(
    equipment,
    [],
    'The Sheet command equipment fixture escaped its rollback transaction.'
  )
}

function assertSheetMatchesFixture(
  sheet: CharacterSheetResponseDto,
  fixture: CharacterLifecycleFixture,
  stage: string
): void {
  assert.equal(sheet.meta.characterId, fixture.characterId)
  assert.equal(sheet.meta.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.equal(sheet.identity.label, fixture.label)
  assert.equal(sheet.identity.raceLabel, fixture.raceLabel)
  assert.equal(sheet.identity.backgroundLabel, 'Acolyte')
  assert.equal(
    sheet.identity.classSummary,
    expectedClassSummary(fixture),
    `${fixture.label} ${stage} exposed the wrong class summary.`
  )
  assert.equal(
    sheet.identity.totalLevel,
    expectedTotalLevel(fixture),
    `${fixture.label} ${stage} exposed the wrong total level.`
  )
  assert.equal(sheet.overview.currentHitPoints, fixture.expectedMaxHitPoints)
  assert.equal(sheet.overview.maxHitPoints, fixture.expectedMaxHitPoints)

  if (fixture.hitDice) {
    for (const expected of fixture.hitDice) {
      const expectedSheetDie = { ...expected, remaining: expected.total - expected.used }
      assert.deepEqual(
        sheet.overview.hitDice.find(({ die }) => die === expected.die),
        expectedSheetDie,
        `${fixture.label} ${stage} overview did not preserve its d${expected.die} hit dice.`
      )
      assert.deepEqual(
        sheet.resources.hitDice.find(({ die }) => die === expected.die),
        expectedSheetDie,
        `${fixture.label} ${stage} resources did not preserve its d${expected.die} hit dice.`
      )
    }
    assert.equal(sheet.overview.hitDice.length, fixture.hitDice.length)
    assert.equal(sheet.resources.hitDice.length, fixture.hitDice.length)
  }
}

async function proveFixtureLifecycle(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  resolutionTimings: BuilderResolutionTiming[]
): Promise<CharacterSheetResponseDto> {
  const initialCharacter = createFixtureCharacter(fixture)
  assertCharacterProgression(initialCharacter, fixture, 'create input', false)
  const initialPayload = await measureBuilderResolution(resolutionTimings, fixture, 'initial', () =>
    resolveCharacterForUser(
      db,
      {
        character: initialCharacter,
        mode: 'create'
      },
      fixture.userId
    )
  )

  assert.equal(initialPayload.resolution.readiness.ready, false)
  assert.ok(
    initialPayload.resolution.readiness.outstandingRequiredChoices.length > 0,
    `${fixture.label} should expose unresolved required Builder choices.`
  )
  for (const classFixture of fixture.classes.filter(({ subclassId }) => subclassId)) {
    assert.ok(
      initialPayload.resolution.outstandingChoices.some(
        (choice) => choice.code === 'SUBCLASS_SELECTION_REQUIRED'
      ),
      `${classFixture.classLabel} ${classFixture.classLevel} did not require its eligible subclass choice.`
    )
  }
  if (fixture.raceLabel === 'Dragonborn') {
    assert.ok(
      initialPayload.resolution.outstandingChoices.some(
        (choice) => choice.code === 'ANCESTRY_SELECTION_REQUIRED'
      ),
      'Dragonborn did not require a draconic ancestry choice.'
    )
  }

  const structuralCharacter = applyStructuralChoices(
    initialPayload.character,
    initialPayload,
    fixture
  )
  const structuralPayload = await measureBuilderResolution(
    resolutionTimings,
    fixture,
    'structural',
    () =>
      resolveCharacterForUser(
        db,
        {
          character: structuralCharacter,
          mode: 'create'
        },
        fixture.userId
      )
  )
  assertCharacterProgression(structuralPayload.character, fixture, 'structural resolution')
  if (fixture.preparedCasterClassId) {
    assert.ok(
      allSpellChoices(structuralPayload).some(
        (choice) =>
          choice.source.kind === 'CLASS' && choice.source.classId === fixture.preparedCasterClassId
      ),
      `${fixture.label} did not expose its required Builder spell choices.`
    )
  }
  const completedCharacter = completeBuilderChoices(structuralPayload.character, structuralPayload)
  const resolvedPayload = await measureBuilderResolution(
    resolutionTimings,
    fixture,
    'completed',
    () =>
      resolveCharacterForUser(
        db,
        {
          character: completedCharacter,
          mode: 'create'
        },
        fixture.userId
      )
  )
  assert.deepEqual(resolvedPayload.resolution.validations, [])
  assert.deepEqual(resolvedPayload.resolution.outstandingChoices, [])
  assert.equal(resolvedPayload.resolution.readiness.ready, true)
  assertCharacterProgression(resolvedPayload.character, fixture, 'resolved character')
  assertResolvedClassLevels(resolvedPayload.resolution, fixture, 'resolved Builder payload')

  const savedDraft = await saveCharacterBuilderDraftForUser(
    db,
    fixture.characterId,
    {
      character: resolvedPayload.character,
      mode: 'create'
    },
    fixture.userId
  )
  assert.equal(savedDraft.characterId, fixture.characterId)
  assert.equal(savedDraft.status, AUTHORED_RECORD_STATUS.DRAFT)

  const reloadedDraft = await getCharacterBuilderDraftForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  assert.ok(reloadedDraft, `${fixture.label} Builder draft could not be reloaded.`)
  const reloadedPayload = characterBuilderDraftPayloadDtoSchema.parse(reloadedDraft.payload)
  assert.deepEqual(
    canonicalize(reloadedPayload.character),
    canonicalize({
      ...resolvedPayload.character,
      status: AUTHORED_RECORD_STATUS.DRAFT
    }),
    `${fixture.label} draft did not preserve the resolved character.`
  )
  assertCharacterProgression(reloadedPayload.character, fixture, 'reloaded draft')

  const reloadedResolution = await measureBuilderResolution(
    resolutionTimings,
    fixture,
    'reloaded',
    () =>
      resolveCharacterForUser(
        db,
        {
          character: reloadedPayload.character,
          mode: 'create'
        },
        fixture.userId
      )
  )
  assert.equal(reloadedResolution.resolution.readiness.ready, true)
  assertCharacterProgression(reloadedResolution.character, fixture, 'reloaded resolution')
  assertResolvedClassLevels(reloadedResolution.resolution, fixture, 'reloaded Builder resolution')

  const preview = await previewCharacterSaveForUser(
    db,
    {
      character: reloadedResolution.character,
      mode: 'create',
      targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
    },
    fixture.userId
  )
  assert.equal(preview.preview.predictedStatus, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.equal(preview.resolution.readiness.ready, true)
  assert.equal(preview.preview.destructive, false)
  assertCharacterProgression(preview.character, fixture, 'save preview')
  assertResolvedClassLevels(preview.resolution, fixture, 'save preview')

  const finalized = await upsertCharacterBuilderForUser(
    db,
    {
      character: preview.character,
      mode: 'create',
      targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
    },
    fixture.userId
  )
  assert.equal(finalized.character.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.equal(finalized.resolution.readiness.ready, true)
  assert.ok(finalized.publicId, `${fixture.label} finalization did not create a public route id.`)
  assertCharacterProgression(finalized.character, fixture, 'finalized character')
  assertResolvedClassLevels(finalized.resolution, fixture, 'finalized resolution')

  const persisted = await createCharacterRepository(db).findAuthoredById(fixture.characterId)
  assert.ok(persisted, `${fixture.label} finalization did not persist the aggregate.`)
  assert.equal(persisted.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assertCharacterProgression(persisted, fixture, 'repository reload')
  assert.equal(
    await getCharacterBuilderDraftForUser(db, fixture.characterId, fixture.userId),
    null,
    `${fixture.label} finalization did not remove the Builder draft.`
  )

  const sheet = await getCharacterSheetForUser(db, fixture.characterId)
  assert.ok(sheet, `${fixture.label} could not be loaded through the Sheet service.`)
  assert.equal(sheet.meta.streamVersion, 1)
  assertSheetMatchesFixture(sheet, fixture, 'Sheet load')

  const reloadedSheet = await getCharacterSheetForUser(db, fixture.characterId)
  assert.ok(reloadedSheet, `${fixture.label} could not be reloaded through the Sheet service.`)
  assert.equal(reloadedSheet.meta.streamVersion, 1)
  assertSheetMatchesFixture(reloadedSheet, fixture, 'Sheet reload')

  return reloadedSheet
}

async function proveRetryAndConcurrencyCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const historyBefore = await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId)
  const command = {
    commandId: randomUUID(),
    expectedVersion: sheet.meta.streamVersion,
    type: 'SET_INSPIRATION' as const,
    inspired: true
  }
  const applied = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId)
  assert.equal(applied.streamVersion, sheet.meta.streamVersion + 1)
  assert.equal(applied.sheet.overview.inspiration, true)

  const persisted = await getCharacterSheetForUser(db, fixture.characterId)
  assert.ok(persisted, `${fixture.label} could not be reloaded after SET_INSPIRATION.`)
  assert.deepEqual(canonicalize(persisted), canonicalize(applied.sheet))
  const historyAfterApply = await getCharacterHistoryForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  assert.equal(historyAfterApply.entries.length, historyBefore.entries.length + 1)

  const retried = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId)
  assert.equal(retried.streamVersion, applied.streamVersion)
  assert.equal(retried.historyEntry?.eventId, applied.historyEntry?.eventId)
  assert.deepEqual(canonicalize(retried.sheet), canonicalize(persisted))
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'An exact command retry appended a duplicate event.'
  )

  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      { ...command, inspired: false },
      fixture.userId
    ),
    /already used with different input/u
  )
  assert.deepEqual(
    canonicalize(await getCharacterSheetForUser(db, fixture.characterId)),
    canonicalize(persisted),
    'Reusing a command id with different input mutated Sheet state.'
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'Reusing a command id with different input appended an event.'
  )

  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      {
        commandId: randomUUID(),
        expectedVersion: command.expectedVersion,
        type: 'SET_INSPIRATION',
        inspired: false
      },
      fixture.userId
    ),
    /stream_version conflict/u
  )
  const afterStaleRejection = await getCharacterSheetForUser(db, fixture.characterId)
  assert.ok(afterStaleRejection, `${fixture.label} disappeared after the stale command rejection.`)
  assert.deepEqual(
    canonicalize(afterStaleRejection),
    canonicalize(persisted),
    'A stale expectedVersion mutated Sheet state.'
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'A stale expectedVersion appended an event.'
  )

  return afterStaleRejection
}

async function proveConditionCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_EXHAUSTION',
    level: 2,
    notes: 'Lifecycle exhaustion'
  })
  assert.equal(current.overview.exhaustion.level, 2)
  assert.equal(current.overview.exhaustion.notes, 'Lifecycle exhaustion')

  const condition = requireRecordByLabel(
    current.reference.conditionOptions,
    'Blinded',
    'condition option'
  )
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADD_CONDITION',
    conditionTypeId: condition.id,
    notes: 'Lifecycle condition'
  })
  assert.deepEqual(
    current.overview.conditions.find(({ conditionTypeId }) => conditionTypeId === condition.id),
    {
      conditionTypeId: condition.id,
      label: condition.label,
      description: condition.description,
      notes: 'Lifecycle condition'
    }
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_CONDITION',
    conditionTypeId: condition.id
  })
  assert.equal(
    current.overview.conditions.some(({ conditionTypeId }) => conditionTypeId === condition.id),
    false
  )

  return current
}

async function proveHitPointRestAndResourceCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const hitDie = sheet.overview.hitDice.find(({ remaining }) => remaining > 0)
  assert.ok(hitDie, `${fixture.label} did not expose an available hit die.`)
  const resource = requireRecordByLabel(sheet.resources.items, 'Second Wind', 'Sheet resource')
  assert.ok(resource.max > 0, 'Second Wind must expose at least one use.')

  const setCurrentHitPoints = Math.max(sheet.overview.maxHitPoints - 5, 1)
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_HIT_POINTS',
    current: setCurrentHitPoints,
    temp: 5
  })
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints)
  assert.equal(current.overview.tempHitPoints, 5)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_HIT_POINTS',
    mode: 'DAMAGE',
    amount: 7
  })
  assert.equal(current.overview.tempHitPoints, 0)
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints - 2)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_HIT_POINTS',
    mode: 'HEAL',
    amount: 3
  })
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints + 1)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPSERT_SHEET_ADJUSTMENT',
    adjustment: {
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: 2,
      sourceNote: 'Lifecycle rest reset'
    }
  })
  assert.equal(current.overview.maxHitPointsModifier, 2)
  assert.ok(current.overview.maxHitPointsModifierAdjustmentId)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SHEET_RESOURCE',
    owner: resource.owner
  })
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 1)
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_HIT_POINTS',
    current: current.overview.currentHitPoints,
    temp: 4
  })

  const shortRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'SHORT',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [{ die: hitDie.die, count: 1 }],
      resetMaximumHitPointModifier: true,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: true
    },
    fixture.userId
  )
  assert.ok(shortRestPreview.rollEvidence, 'Short-rest preview did not return exact roll evidence.')
  assert.equal(shortRestPreview.canApply, true)
  const shortRestCommandId = randomUUID()
  const shortRestResult = await dispatchCommandForUser(
    db,
    fixture.characterId,
    {
      type: 'COMPLETE_REST',
      commandId: shortRestCommandId,
      expectedVersion: current.meta.streamVersion,
      restKind: 'SHORT',
      previewFingerprint: shortRestPreview.previewFingerprint,
      selectedHitDice: [{ die: hitDie.die, count: 1 }],
      resetMaximumHitPointModifier: true,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollEvidence: shortRestPreview.rollEvidence
    },
    fixture.userId
  )
  assert.equal(shortRestResult.streamVersion, current.meta.streamVersion + 1)
  assert.equal(shortRestResult.result?.type, 'COMPLETE_REST')
  assert.deepEqual(
    shortRestResult.result?.rest.rollEvidence,
    shortRestPreview.rollEvidence,
    'Completed rest did not preserve the exact accepted dice evidence.'
  )
  current = shortRestResult.sheet
  assert.equal(current.overview.tempHitPoints, 4)
  assert.equal(current.overview.maxHitPointsModifier, 0)
  assert.equal(current.overview.maxHitPointsModifierAdjustmentId, null)
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 0)
  assert.equal(
    current.overview.hitDice.find(({ die }) => die === hitDie.die)?.used,
    hitDie.used + 1
  )
  const shortRestHistory = await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId)
  assert.deepEqual(
    shortRestHistory.entries.at(-1)?.result,
    shortRestResult.result,
    'Completed-rest event did not round-trip its exact result.'
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_HIT_POINTS',
    current: 1,
    temp: 4
  })
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SHEET_RESOURCE',
    owner: resource.owner
  })
  const recoverableSlot = current.spells.slots.find((slot) => slot.remaining > 0)
  if (recoverableSlot) {
    current = await dispatchAndReloadSheetCommand(db, fixture, current, {
      type: 'USE_SPELL_SLOT',
      slotKey: recoverableSlot.slotKey
    })
  }
  const staleLongRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'LONG',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false
    },
    fixture.userId
  )
  const staleVersion = current.meta.streamVersion
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_INSPIRATION',
    inspired: !current.overview.inspiration
  })
  const beforeStaleRest = canonicalize(current)
  const historyBeforeStaleRest = await getCharacterHistoryForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      {
        type: 'COMPLETE_REST',
        commandId: randomUUID(),
        expectedVersion: staleVersion,
        restKind: 'LONG',
        previewFingerprint: staleLongRestPreview.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      },
      fixture.userId
    ),
    /stream_version conflict/u
  )
  assert.deepEqual(
    canonicalize(await getCharacterSheetForUser(db, fixture.characterId)),
    beforeStaleRest
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyBeforeStaleRest,
    'A stale completed rest appended an event.'
  )

  const longRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'LONG',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false
    },
    fixture.userId
  )
  const hitDiceUsedBeforeLongRest = current.overview.hitDice.reduce((sum, die) => sum + die.used, 0)
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'COMPLETE_REST',
    restKind: 'LONG',
    previewFingerprint: longRestPreview.previewFingerprint,
    selectedHitDice: [],
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC',
    manualHealingAccepted: false,
    selectedCompanionInstanceIds: []
  })
  assert.equal(current.overview.currentHitPoints, current.overview.maxHitPoints)
  assert.equal(current.overview.tempHitPoints, 0)
  assert.equal(current.overview.exhaustion.level, 1)
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 0)
  assert.ok(
    current.overview.hitDice.reduce((sum, die) => sum + die.used, 0) < hitDiceUsedBeforeLongRest,
    'A long rest did not restore any used hit dice.'
  )

  return current
}

interface InventoryCommandFixtureState {
  containerId: string
  itemId: string
  sheet: CharacterSheetResponseDto
}

function requireAddedInventoryItem(
  before: CharacterSheetResponseDto,
  after: CharacterSheetResponseDto,
  equipmentId: string
): CharacterSheetResponseDto['inventory']['items'][number] {
  const existingIds = new Set(before.inventory.items.map(({ id }) => id))
  const added = after.inventory.items.filter(
    (item) => item.equipmentId === equipmentId && !existingIds.has(item.id)
  )
  assert.equal(
    added.length,
    1,
    'Expected one newly added inventory item for equipment ' + equipmentId + '.'
  )
  return added[0] as CharacterSheetResponseDto['inventory']['items'][number]
}

async function proveInventoryItemCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto,
  attunementEquipmentId: string
): Promise<InventoryCommandFixtureState> {
  const containerEquipment = requireRecordByLabel(
    sheet.reference.equipmentOptions,
    'Backpack',
    'equipment option'
  )
  assert.equal(containerEquipment.isContainer, true)
  const attunementEquipment = sheet.reference.equipmentOptions.find(
    ({ id }) => id === attunementEquipmentId
  )
  assert.ok(
    attunementEquipment,
    'The transaction-local attunement equipment was not resolved for Sheet commands.'
  )
  assert.equal(attunementEquipment.requiresAttunement, true)

  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: containerEquipment.id,
    quantity: 1,
    customName: 'Lifecycle Pack'
  })
  const container = requireAddedInventoryItem(sheet, current, containerEquipment.id)
  assert.ok(
    current.inventory.containers?.some(({ id }) => id === container.id),
    'The added Backpack was not exposed as a Sheet container.'
  )

  const beforeItem = current
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: attunementEquipment.id,
    quantity: 1
  })
  const item = requireAddedInventoryItem(beforeItem, current, attunementEquipment.id)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: item.id,
    quantity: 2,
    containerId: container.id,
    customName: 'Lifecycle Attunement Club',
    notes: 'Moved through the Sheet command integration proof.'
  })
  const movedItem = current.inventory.items.find(({ id }) => id === item.id)
  assert.ok(movedItem, 'The moved inventory item was not found.')
  assert.equal(movedItem.quantity, 2)
  assert.equal(movedItem.containerId, container.id)
  assert.equal(movedItem.customName, 'Lifecycle Attunement Club')
  assert.equal(movedItem.notes, 'Moved through the Sheet command integration proof.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'EQUIP_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.equipped, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UNEQUIP_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.equipped, false)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ATTUNE_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.attuned, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UNATTUNE_ITEM',
    itemId: item.id
  })
  assert.equal(current.inventory.items.find(({ id }) => id === item.id)?.attuned, false)

  return { containerId: container.id, itemId: item.id, sheet: current }
}

function getCurrencyAmount(
  sheet: CharacterSheetResponseDto,
  currencyId: string,
  containerId?: string
): number {
  return (
    sheet.inventory.currencies.find(
      (currency) => currency.currencyId === currencyId && currency.containerId === containerId
    )?.amount ?? 0
  )
}

async function proveCurrencyCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  inventory: InventoryCommandFixtureState
): Promise<InventoryCommandFixtureState> {
  const currency = requireRecordByLabel(
    inventory.sheet.reference.currencyOptions,
    'Gold Piece',
    'currency option'
  )
  const initialCarriedAmount = getCurrencyAmount(inventory.sheet, currency.id)
  let current = await dispatchAndReloadSheetCommand(db, fixture, inventory.sheet, {
    type: 'ADJUST_CURRENCY',
    currencyId: currency.id,
    amount: 10
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 10)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_CURRENCY',
    currencyId: currency.id,
    amount: 4,
    containerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 4)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'MOVE_CURRENCY',
    currencyId: currency.id,
    amount: 3,
    toContainerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 7)
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 7)
  assert.equal(
    current.inventory.containers
      ?.find(({ id }) => id === inventory.containerId)
      ?.currencies.find(({ currencyId }) => currencyId === currency.id)?.amount,
    7
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'MOVE_CURRENCY',
    currencyId: currency.id,
    amount: 7,
    fromContainerId: inventory.containerId
  })
  assert.equal(getCurrencyAmount(current, currency.id), initialCarriedAmount + 14)
  assert.equal(getCurrencyAmount(current, currency.id, inventory.containerId), 0)

  return { ...inventory, sheet: current }
}

async function proveInventoryRemovalCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  inventory: InventoryCommandFixtureState
): Promise<CharacterSheetResponseDto> {
  let current = await dispatchAndReloadSheetCommand(db, fixture, inventory.sheet, {
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: inventory.itemId,
    containerId: null
  })
  assert.equal(
    current.inventory.items.find(({ id }) => id === inventory.itemId)?.containerId,
    undefined
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: inventory.itemId
  })
  assert.equal(
    current.inventory.items.some(({ id }) => id === inventory.itemId),
    false
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_INVENTORY_ITEM',
    itemId: inventory.containerId
  })
  assert.equal(
    current.inventory.items.some(({ id }) => id === inventory.containerId),
    false
  )

  return current
}

async function proveNoteCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const existingGroupIds = new Set(sheet.notes.groups?.map(({ id }) => id) ?? [])
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'CREATE_NOTE_GROUP',
    label: 'Lifecycle Notes'
  })
  const group = current.notes.groups?.find(
    ({ id, kind }) => kind === 'CUSTOM' && !existingGroupIds.has(id)
  )
  assert.ok(group, 'CREATE_NOTE_GROUP did not expose the persisted custom group.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_NOTE_GROUP',
    groupId: group.id,
    label: 'Lifecycle Session Notes',
    sortOrder: 0
  })
  const updatedGroup = current.notes.groups?.find(({ id }) => id === group.id)
  assert.equal(updatedGroup?.label, 'Lifecycle Session Notes')
  assert.equal(updatedGroup?.sortOrder, 0)

  const existingNoteIds = new Set(current.notes.items?.map(({ id }) => id) ?? [])
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'CREATE_NOTE',
    title: 'Lifecycle note',
    body: 'Created through the production Sheet command path.',
    groupId: group.id
  })
  const note = current.notes.items?.find(({ id }) => !existingNoteIds.has(id))
  assert.ok(note, 'CREATE_NOTE did not expose the persisted note.')

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPDATE_NOTE',
    noteId: note.id,
    title: 'Updated lifecycle note',
    body: 'Updated through the production Sheet command path.',
    pinned: true
  })
  const updatedNote = current.notes.items?.find(({ id }) => id === note.id)
  assert.equal(updatedNote?.title, 'Updated lifecycle note')
  assert.equal(updatedNote?.body, 'Updated through the production Sheet command path.')
  assert.equal(updatedNote?.pinned, true)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'DELETE_NOTE',
    noteId: note.id
  })
  assert.equal(current.notes.items?.some(({ id }) => id === note.id) ?? false, false)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'DELETE_NOTE_GROUP',
    groupId: group.id
  })
  assert.equal(current.notes.groups?.some(({ id }) => id === group.id) ?? false, false)

  return current
}

async function provePreparedCasterCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<void> {
  const preparedCasterClassId = fixture.preparedCasterClassId
  assert.ok(preparedCasterClassId, `${fixture.label} has no prepared caster class.`)
  const preparedCasterClass = fixture.classes.find(
    ({ classId }) => classId === preparedCasterClassId
  )
  assert.ok(preparedCasterClass, `${fixture.label} prepared caster class is not in the fixture.`)
  const preparationSource = sheet.spells.preparationSources?.find(
    (source) => source.classId === preparedCasterClassId
  )
  assert.ok(
    preparationSource,
    `${preparedCasterClass.classLabel} did not expose a preparation source.`
  )
  const spell = sheet.spells.spells.find(
    (candidate) =>
      candidate.level === 1 &&
      candidate.sources?.some(
        (source) =>
          source.classId === preparedCasterClassId &&
          source.canPrepare &&
          source.acquisition !== 'ALWAYS_PREPARED' &&
          source.acquisition !== 'GRANTED'
      )
  )
  assert.ok(spell, `${preparedCasterClass.classLabel} did not expose a preparable 1st-level spell.`)

  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_PREPARED_SPELLS',
    classId: preparedCasterClassId,
    spellIds: [spell.id]
  })
  assert.equal(current.meta.streamVersion, 2)
  const preparedSpell = current.spells.spells.find((candidate) => candidate.id === spell.id)
  const preparedSource = preparedSpell?.sources?.find(
    (source) => source.classId === preparedCasterClassId && source.canPrepare
  )
  assert.equal(preparedSource?.prepared, true)

  const slot = current.spells.slots.find(
    (candidate) => candidate.level === 1 && candidate.remaining > 0
  )
  assert.ok(
    slot,
    `${preparedCasterClass.classLabel} did not expose an available 1st-level spell slot.`
  )
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'CAST_SPELL',
    spellId: spell.id,
    ...(preparedSource?.id ? { sourceId: preparedSource.id } : {}),
    slotKey: slot.slotKey
  })
  assert.equal(current.meta.streamVersion, 3)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    slot.used + 1
  )

  const reloadedSpell = current.spells.spells.find((candidate) => candidate.id === spell.id)
  assert.equal(
    reloadedSpell?.sources?.find((source) => source.classId === preparedCasterClassId)?.prepared,
    true
  )
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    slot.used + 1
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'RESTORE_SPELL_SLOT',
    slotKey: slot.slotKey,
    all: true
  })
  assert.equal(current.meta.streamVersion, 4)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    0
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SPELL_SLOT',
    slotKey: slot.slotKey
  })
  assert.equal(current.meta.streamVersion, 5)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    1
  )
}

async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const db = createDb({ connectionString })
  const characterIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  const attunementEquipmentId = randomUUID()
  const rollback = new Error('ROLLBACK_CHARACTER_LIFECYCLE_INTEGRATION_PROOF')
  const resolutionOnly = process.env.CHARACTER_LIFECYCLE_RESOLUTION_ONLY === '1'
  const requestedFixture = process.env.CHARACTER_LIFECYCLE_FIXTURE
  let completed = false
  let executedFixtureLabels: string[] = []
  const startedAt = Date.now()
  const builderResolutionTimings: BuilderResolutionTiming[] = []

  try {
    try {
      await db.transaction().execute(async (trx) => {
        const catalog = await findFixtureCatalog(trx)
        await createAttunementEquipmentFixture(trx, catalog, attunementEquipmentId)
        const fixtures: CharacterLifecycleFixture[] = [
          {
            ...catalog,
            characterId: characterIds[0] as string,
            classes: [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }],
            expectedMaxHitPoints: 12,
            hitpointLevels: [{ level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 }],
            label: 'MVP Martial Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...catalog,
            characterId: characterIds[1] as string,
            classes: [
              {
                classId: catalog.clericId,
                classLabel: 'Cleric',
                classLevel: 1,
                subclassId: catalog.lifeDomainId,
                subclassLabel: 'Life Domain'
              }
            ],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: catalog.clericId, classLevel: 1, value: 10 }],
            label: 'MVP Prepared Caster Lifecycle Proof',
            preparedCasterClassId: catalog.clericId,
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...catalog,
            characterId: characterIds[2] as string,
            classes: [
              {
                classId: catalog.fighterId,
                classLabel: 'Fighter',
                classLevel: 3,
                subclassId: catalog.championId,
                subclassLabel: 'Champion'
              }
            ],
            expectedMaxHitPoints: 25,
            hitpointLevels: [
              { level: 1, classId: catalog.fighterId, classLevel: 1, value: 11 },
              { level: 2, classId: catalog.fighterId, classLevel: 2, value: 7 },
              { level: 3, classId: catalog.fighterId, classLevel: 3, value: 7 }
            ],
            label: 'MVP Choice-Heavy Lifecycle Proof',
            raceId: catalog.dragonbornId,
            raceLabel: 'Dragonborn'
          },
          {
            ...catalog,
            characterId: characterIds[3] as string,
            classes: [
              { classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 2 },
              { classId: catalog.rogueId, classLabel: 'Rogue', classLevel: 1 }
            ],
            expectedMaxHitPoints: 27,
            hitDice: [
              { die: 10, total: 2, used: 0 },
              { die: 8, total: 1, used: 0 }
            ],
            hitpointLevels: [
              { level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 },
              { level: 2, classId: catalog.rogueId, classLevel: 1, value: 7 },
              { level: 3, classId: catalog.fighterId, classLevel: 2, value: 8 }
            ],
            label: 'MVP Multiclass HP Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          }
        ]
        const selectedFixtures = requestedFixture
          ? fixtures.filter(({ label }) => label.includes(requestedFixture))
          : fixtures
        assert.ok(
          selectedFixtures.length > 0,
          `No Character lifecycle fixture matched "${requestedFixture ?? ''}".`
        )
        executedFixtureLabels = selectedFixtures.map(({ label }) => label)

        for (const fixture of selectedFixtures) {
          let sheet = await proveFixtureLifecycle(trx, fixture, builderResolutionTimings)
          console.info(
            JSON.stringify({
              fixture: fixture.label,
              builderToSheetLifecycle: 'verified'
            })
          )
          if (resolutionOnly) continue

          if (fixture.preparedCasterClassId) {
            await provePreparedCasterCommands(trx, fixture, sheet)
          }
          if (fixture.hitDice) {
            sheet = await proveRetryAndConcurrencyCommands(trx, fixture, sheet)
            sheet = await proveConditionCommands(trx, fixture, sheet)
            sheet = await proveHitPointRestAndResourceCommands(trx, fixture, sheet)
            let inventory = await proveInventoryItemCommands(
              trx,
              fixture,
              sheet,
              attunementEquipmentId
            )
            inventory = await proveCurrencyCommands(trx, fixture, inventory)
            sheet = await proveInventoryRemovalCommands(trx, fixture, inventory)
            await proveNoteCommands(trx, fixture, sheet)
          }
        }

        completed = true
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    }

    assert.equal(completed, true, 'The Character lifecycle proof did not reach its assertions.')
    for (const characterId of characterIds) {
      await assertFixtureWasRolledBack(db, characterId)
    }
    await assertCommandEquipmentWasRolledBack(db, attunementEquipmentId)
    console.info(
      JSON.stringify({
        draftPersistence: 'verified',
        builderResolutionLatency: {
          maxMs: Math.max(...builderResolutionTimings.map(({ durationMs }) => durationMs)),
          p50Ms: percentileDuration(builderResolutionTimings, 0.5),
          p95Ms: percentileDuration(builderResolutionTimings, 0.95),
          samples: builderResolutionTimings
        },
        durationMs: Date.now() - startedAt,
        finalization: 'verified',
        fixtures: executedFixtureLabels,
        localDatabaseOnly: true,
        multiclassHitPointOrder: 'verified',
        preparedSpellPersistence: 'verified',
        preview: 'verified',
        resolution: 'verified',
        rollback: 'verified',
        sheet: 'verified',
        sheetCommandPersistence: {
          conditions: ['SET_EXHAUSTION', 'ADD_CONDITION', 'REMOVE_CONDITION'],
          currency: ['ADJUST_CURRENCY', 'MOVE_CURRENCY'],
          hitPointsAndRest: [
            'SET_HIT_POINTS',
            'ADJUST_HIT_POINTS',
            'USE_SHEET_RESOURCE',
            'COMPLETE_REST',
            'exact rest result replay',
            'stale rest no-write rejection'
          ],
          inspirationAndConcurrency: [
            'SET_INSPIRATION',
            'exact retry',
            'same commandId rejection',
            'stale expectedVersion rejection'
          ],
          inventory: [
            'ADD_INVENTORY_ITEM',
            'UPDATE_INVENTORY_ITEM',
            'REMOVE_INVENTORY_ITEM',
            'EQUIP_ITEM',
            'UNEQUIP_ITEM',
            'ATTUNE_ITEM',
            'UNATTUNE_ITEM'
          ],
          notes: [
            'CREATE_NOTE_GROUP',
            'UPDATE_NOTE_GROUP',
            'DELETE_NOTE_GROUP',
            'CREATE_NOTE',
            'UPDATE_NOTE',
            'DELETE_NOTE'
          ],
          spells: ['SET_PREPARED_SPELLS', 'CAST_SPELL', 'RESTORE_SPELL_SLOT', 'USE_SPELL_SLOT']
        },
        sheetReload: 'verified'
      })
    )
  } finally {
    await db.destroy()
  }
}

await main()
