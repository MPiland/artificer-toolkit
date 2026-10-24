import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterSummon } from '../encounterSummon.js'

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

const build = (statBlock: Parameters<typeof buildEncounterSummon>[0]['summon']['statBlock']) =>
  buildEncounterSummon({
    summon: { statBlock },
    caster,
    casterHitPointMaximum: 40,
    label: 'Spiritual Weapon',
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
      owner: { ownerActorId: caster.id },
      initiative: null
    })
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

  it('reads hit points from the stat block against the caster, and is 0 when it names none', () => {
    expect(build({ hitPoints: { kind: 'HIT_POINT_MAXIMUM' } }).actor).toMatchObject({
      maxHitPoints: 40,
      currentHitPoints: 40
    })
    expect(build({ hitPoints: { kind: 'FIXED', value: 12 } }).actor.maxHitPoints).toBe(12)
    expect(build({}).actor.maxHitPoints).toBe(0)
  })
})
