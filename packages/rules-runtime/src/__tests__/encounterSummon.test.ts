import { describe, expect, it } from 'vitest'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import type { SummonStatBlockDto } from '@artificer-toolkit/schema/effects/manifest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActorBody, encounterActorCannotAttack } from '../encounterActorBody.js'
import type { EncounterActorFormCreature } from '../encounterActorForm.js'
import { compileActionPlacement } from '../encounterActionEntryPointCompiler.js'
import { snapshotStatBlock } from '../encounterProjection.js'
import { buildEncounterSummon, formSummonStats, withSummonFormSpeeds } from '../encounterSummon.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { groupCountChange, groupHitPointPool, summonHitPoints } from '../summonHitPoints.js'

const USER = crypto.randomUUID()
const NOW = '2026-10-23T00:00:00.000Z'
const caster = encounterRunActorStateSchema.parse({
  id: crypto.randomUUID(),
  encounterId: crypto.randomUUID(),
  sideId: crypto.randomUUID(),
  kind: 'CHARACTER',
  sourceId: crypto.randomUUID(),
  frozenState: null,
  absence: null,
  form: null,
  label: 'Aria',
  systemId: crypto.randomUUID(),
  stableTieKey: crypto.randomUUID(),
  public: true,
  controllerUserIds: [USER],
  disposition: 'FRIENDLY',
  healthDisplay: null,
  resources: {},
  gmNotes: null,
  initiative: null,
  manualOrder: null,
  createdAt: NOW,
  updatedAt: NOW,
  snapshot: {
    kind: 'CHARACTER',
    id: crypto.randomUUID(),
    label: 'Aria',
    systemId: crypto.randomUUID()
  }
})

const CARRIER_ID = crypto.randomUUID()

const build = (
  statBlock: SummonStatBlockDto,
  cannotAttack = false,
  turnTiming?: 'AFTER_OWNER' | 'OWN_INITIATIVE'
) =>
  buildEncounterSummon({
    summon: { kind: 'STAT_BLOCK', statBlock },
    spellSummon: null,
    cannotAttack,
    turnTiming,
    caster,
    casterHitPointMaximum: 40,
    label: 'Spiritual Weapon',
    sourceEffectId: CARRIER_ID,
    point: { x: 250, y: 150 },
    edgeLength: 100,
    occurredAt: NOW
  })

describe('buildEncounterSummon', () => {
  it('owns the actor by the caster, on its side, controlled through that owner', () => {
    const { actor } = build({})
    expect(actor).toMatchObject({
      kind: 'CUSTOM',
      label: 'Spiritual Weapon',
      encounterId: caster.encounterId,
      sideId: caster.sideId,
      disposition: 'FRIENDLY',
      controllerUserIds: [],
      owner: { ownerActorId: caster.id, sourceEffectId: CARRIER_ID },
      initiative: null
    })
  })

  it('keeps an authored turn timing on its owner link, and none by default (D200)', () => {
    expect(build({}).actor.owner).toEqual({ ownerActorId: caster.id, sourceEffectId: CARRIER_ID })
    expect(build({}, false, 'OWN_INITIATIVE').actor.owner).toEqual({
      ownerActorId: caster.id,
      sourceEffectId: CARRIER_ID,
      turnTiming: 'OWN_INITIATIVE'
    })
  })

  it('records how many creatures a group summon stands for on its owner link (SPELLS-35.T7)', () => {
    const { actor } = buildEncounterSummon({
      summon: {
        kind: 'CREATURE',
        creature: {
          sourceId: crypto.randomUUID(),
          sourceRevision: 1,
          systemId: caster.systemId,
          maxHitPoints: 11,
          snapshot: { kind: 'CREATURE', payload: {} }
        } as unknown as EncounterActorFormCreature,
        creatureTypeId: null,
        count: 4
      },
      spellSummon: null,
      turnTiming: 'OWN_INITIATIVE',
      caster,
      casterHitPointMaximum: 40,
      label: 'Wolf',
      sourceEffectId: CARRIER_ID,
      point: { x: 250, y: 150 },
      edgeLength: 100,
      occurredAt: NOW
    })
    expect(actor.owner).toEqual({
      ownerActorId: caster.id,
      sourceEffectId: CARRIER_ID,
      turnTiming: 'OWN_INITIATIVE',
      count: 4
    })
  })

  it('holds the pool of every creature in a group, and one creature’s hit points when it has no count (SPELLS-35.T7)', () => {
    const summonAt = (count: number | null) =>
      buildEncounterSummon({
        summon: {
          kind: 'CREATURE',
          creature: {
            sourceId: crypto.randomUUID(),
            sourceRevision: 1,
            systemId: caster.systemId,
            maxHitPoints: 11,
            snapshot: { kind: 'CREATURE', payload: {} }
          } as unknown as EncounterActorFormCreature,
          creatureTypeId: null,
          count
        },
        spellSummon: null,
        caster,
        casterHitPointMaximum: 40,
        label: 'Wolf',
        sourceEffectId: CARRIER_ID,
        point: { x: 250, y: 150 },
        edgeLength: 100,
        occurredAt: NOW
      }).actor
    expect(summonAt(8)).toMatchObject({ currentHitPoints: 88, maxHitPoints: 88 })
    expect(summonAt(null)).toMatchObject({ currentHitPoints: 11, maxHitPoints: 11 })
  })

  it('sizes a group pool, leaves hit points when the count is lowered and grows them when it is raised (SPELLS-35.T7)', () => {
    expect(groupHitPointPool(11, 8)).toBe(88)
    expect(groupHitPointPool(11, null)).toBe(11)
    const damaged = { maxHitPoints: 33, currentHitPoints: 28 }
    expect(groupCountChange(damaged, 11, 3, 2)).toEqual({})
    expect(groupCountChange(damaged, 11, 3, 3)).toEqual({})
    expect(groupCountChange(damaged, 11, 3, 5)).toEqual({ maxHitPoints: 55, currentHitPoints: 50 })
    // After a lower the maximum is no longer a multiple of the count; one creature's hit points still is 11.
    expect(groupCountChange(damaged, 11, 2, 4)).toEqual({ maxHitPoints: 55, currentHitPoints: 50 })
  })

  it('stands the token at the point with the caster’s controllers', () => {
    expect(build({}).token).toMatchObject({
      label: 'Spiritual Weapon',
      position: { x: 250, y: 150 },
      width: 100,
      height: 100,
      controlledByUserIds: [USER]
    })
  })

  it('keeps the stat block body in the actor snapshot, which is damageable and takes no space by default', () => {
    expect(
      encounterActorBody(build({ damageabilityKind: 'INVULNERABLE', occupiesSpace: true }).actor)
    ).toEqual({ invulnerable: true, occupiesSpace: true })
    expect(build({}).actor.snapshot).toMatchObject({
      body: { damageabilityKind: 'NORMAL', occupiesSpace: false }
    })
    expect(encounterActorBody(caster)).toEqual({ invulnerable: false, occupiesSpace: true })
  })

  it('keeps that its summon cannot attack, and no other actor reads so', () => {
    expect(encounterActorCannotAttack(build({ occupiesSpace: true }, true).actor)).toBe(true)
    expect(encounterActorCannotAttack(build({ occupiesSpace: true }).actor)).toBe(false)
    expect(encounterActorCannotAttack(caster)).toBe(false)
  })

  it('reads hit points from the stat block against the caster, and is 0 when it names none', () => {
    expect(build({ hitPoints: { kind: 'HIT_POINT_MAXIMUM' } }).actor).toMatchObject({
      maxHitPoints: 40,
      currentHitPoints: 40
    })
    expect(build({ hitPoints: { kind: 'FIXED', value: 12 } }).actor).toMatchObject({
      maxHitPoints: 12
    })
    expect(build({}).actor).toMatchObject({ maxHitPoints: 0 })
  })
})

describe('a form summon with authored speeds (QUALITY-15.T3aa2)', () => {
  const spell = srdByLabel(SRD.spells, 'Phantom Steed')
  const placement = compileActionPlacement(
    dnd5eCharacterRuleActionSystemAdapter,
    characterActionDescriptor(
      compileSpellEffect(spell, { ...spell.effects![0]!, id: ACTION_EFFECT_ID }),
      spell.level,
      20
    )
  )
  const summon = placement?.kind === 'SUMMON' ? placement.summonPlacement : null
  if (!summon || !('forms' in summon)) throw new Error('Phantom Steed summons a form.')
  const [form] = summon.forms
  const horse = srdByLabel(SRD.creatures, 'Riding Horse')
  const horseOf = (speeds: readonly unknown[]) =>
    ({
      sourceId: horse.id,
      sourceRevision: 1,
      systemId: caster.systemId,
      maxHitPoints: horse.hitPoints,
      snapshot: { kind: 'CREATURE', payload: { speeds, hitPoints: horse.hitPoints } }
    }) as unknown as EncounterActorFormCreature
  const walkOf = (speeds: readonly { speedId: string; amount: number }[]) =>
    speeds.find(({ speedId }) => speedId === horse.speeds[0]!.speedId)?.amount

  it('compiles Phantom Steed as a Riding Horse form that walks 100 feet', () => {
    expect(form).toMatchObject({
      label: 'Riding Horse',
      creatureId: horse.id,
      maxTargets: 1,
      speeds: [{ speedId: horse.speeds[0]!.speedId, amount: 100, unit: 'FEET' }]
    })
  })

  it('places the steed with 100 feet of walking in its actor and in the values its owner lists', () => {
    const creature = withSummonFormSpeeds(horseOf(horse.speeds), form!.speeds)
    const { actor } = buildEncounterSummon({
      summon: { kind: 'CREATURE', creature, creatureTypeId: null, count: null },
      spellSummon: null,
      caster,
      casterHitPointMaximum: 40,
      label: 'Riding Horse',
      sourceEffectId: CARRIER_ID,
      point: { x: 250, y: 150 },
      edgeLength: 100,
      occurredAt: NOW
    })
    expect(walkOf(snapshotStatBlock(actor)!.speeds)).toBe(100)
    expect(walkOf(formSummonStats(creature).speeds ?? [])).toBe(100)
  })

  it('keeps the creature’s other speeds and adds a speed it lacks', () => {
    const fly = { speedId: crypto.randomUUID(), amount: 30, unit: 'FEET' as const }
    const [walk] = horse.speeds
    expect(withSummonFormSpeeds(horseOf([walk, fly]), form!.speeds).snapshot).toMatchObject({
      payload: { speeds: [{ ...walk, amount: 100 }, fly] }
    })
    expect(withSummonFormSpeeds(horseOf([fly]), form!.speeds).snapshot).toMatchObject({
      payload: { speeds: [fly, { ...walk, amount: 100 }] }
    })
  })

  it('leaves a form without authored speeds as it is', () => {
    const creature = horseOf(horse.speeds)
    expect(withSummonFormSpeeds(creature, undefined)).toBe(creature)
  })
})

describe('summon hit points', () => {
  it('is 0 when the stat block authors none, and the evaluated value otherwise', () => {
    expect(summonHitPoints({}, 40)).toBe(0)
    expect(summonHitPoints({ hitPoints: { kind: 'HIT_POINT_MAXIMUM' } }, 40)).toBe(40)
  })
})
