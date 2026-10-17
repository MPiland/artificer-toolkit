import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { ballBearingsBagOf1000 } from './equipment/ball-bearings-bag-of-1000.js'
import { caltropsBagOf20 } from './equipment/caltrops-bag-of-20.js'
import { huntingTrap } from './equipment/hunting-trap.js'
import { oilFlask } from './equipment/oil-flask.js'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { bladeBarrier } from './spells/blade-barrier.js'
import { cloudkill } from './spells/cloudkill.js'
import { insectPlague } from './spells/insect-plague.js'
import { spiritGuardians } from './spells/spirit-guardians.js'

/** The interaction kinds each labelled manifest component authors, wherever it is nested. */
function interactionKindsByComponent(node: unknown): Record<string, readonly string[]> {
  if (Array.isArray(node)) return Object.assign({}, ...node.map(interactionKindsByComponent))
  if (typeof node !== 'object' || node === null) return {}
  const record = node as Record<string, unknown>
  const kinds = Array.isArray(record.interactionKinds)
    ? (record.interactionKinds as string[])
    : null
  const own = typeof record.label === 'string' && kinds ? { [record.label]: kinds } : {}
  return Object.assign(own, ...Object.values(record).map(interactionKindsByComponent))
}

/**
 * SPELLS-17.2 and 17.5: the SRD says a creature that "enters the area" (or steps on a trap's plate)
 * triggers the effect, which includes a move that passes through and ends outside it.
 */
describe('SRD zones that trigger on entering the area pass-through too', () => {
  it.each([
    ['Caltrops', caltropsBagOf20, 'Enter the caltrop field'],
    ['Ball Bearings', ballBearingsBagOf1000, 'Move across the ball bearings'],
    ['Oil Flask', oilFlask, 'Enter burning oil'],
    ['Hunting Trap', huntingTrap, 'Pressure plate'],
    ['Blade Barrier', bladeBarrier, 'Whirling Blades']
  ])('%s authors its enter component as ENTER_OR_PASS_THROUGH', (_name, subject, component) => {
    const kinds = interactionKindsByComponent(subject)[component]
    expect(kinds).toContain('ENTER_OR_PASS_THROUGH')
    expect(kinds).not.toContain('ENTER_SPACE')
  })

  it('keeps the turn-based components of Oil Flask and Blade Barrier as they are', () => {
    expect(interactionKindsByComponent(oilFlask)['End turn in burning oil']).toEqual([
      'END_TURN_IN_SPACE'
    ])
    expect(interactionKindsByComponent(bladeBarrier)['Whirling Blades']).toContain(
      'START_TURN_IN_SPACE'
    )
  })

  it('catches a creature of Spirit Guardians on entering and on starting its turn in the area', () => {
    expect(interactionKindsByComponent(spiritGuardians)['Enter the spirits']).toEqual([
      'ENTER_SPACE',
      'START_TURN_IN_SPACE'
    ])
  })

  it('catches a creature of Cloudkill on entering and on starting its turn in the fog', () => {
    expect(interactionKindsByComponent(cloudkill)['Enter the poisonous fog']).toEqual([
      'ENTER_SPACE',
      'START_TURN_IN_SPACE'
    ])
  })

  it('catches a creature of Insect Plague on entering and on ending its turn in the swarm', () => {
    expect(interactionKindsByComponent(insectPlague)['Enter the locust swarm']).toEqual([
      'ENTER_SPACE',
      'END_TURN_IN_SPACE'
    ])
  })
})

/**
 * The ZONE manifest a spell's cast places, found by narrowing the authored record; a cast-time pick
 * between zones (D140) is read from its first option.
 */
function placedZoneOf(spell: SpellAuthored) {
  const path = spell.effects?.[0]?.paths[0]
  const outcome = (
    path?.selectionKind === 'FIXED'
      ? path.resultBlock
      : path?.selectionKind === 'CHOICE'
        ? path.options[0]?.resultBlock
        : undefined
  )?.outcomes[0]
  if (outcome?.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'ZONE')
    throw new Error(`${spell.label} must place a zone.`)
  return outcome
}

/**
 * SPELLS-4.T1a: SRD rules of Cloudkill and Insect Plague a placed zone cannot run yet. The zone
 * compiler refuses any authored option it does not model, so each stays unauthored (the zone then
 * still compiles) and leaves this list when a task models it (registration is the orchestrator's).
 */
describe('Cloudkill and Insect Plague rules a placed zone does not run yet (SPELLS-4.T1a)', () => {
  const zoneGaps = [
    ['Cloudkill', cloudkill, 'heavily obscured area', 'obscurementKind', 'no task yet'],
    ['Cloudkill', cloudkill, 'fog spreads around corners', 'spreadsAroundCorners', 'no task yet'],
    ['Insect Plague', insectPlague, 'lightly obscured area', 'obscurementKind', 'no task yet'],
    [
      'Insect Plague',
      insectPlague,
      'swarm spreads around corners',
      'spreadsAroundCorners',
      'no task yet'
    ]
  ] as const
  it.each(zoneGaps)('%s: the %s is unauthored (%s, %s)', (_name, spell, _rule, option) => {
    expect(placedZoneOf(spell)).not.toHaveProperty(option)
  })

  it('leaves Insect Plague’s difficult terrain unauthored on its component (movementCostMultiplier, SPELLS-20.T4d)', () => {
    expect(placedZoneOf(insectPlague).components?.[0]).not.toHaveProperty('movementCostMultiplier')
  })

  /**
   * Not authorable at all yet, so nothing in the record can show them: Cloudkill's fog moving 10
   * feet away from the caster at the start of each of the caster's turns and sinking to the lowest
   * ground, strong wind dispersing it, and Insect Plague's save for each creature in the area when
   * it appears (a cast that places a zone has no cast-time area save). Each needs a new core option.
   * Also not exact: the per-turn limit counts every application, so an Insect Plague creature that
   * enters and ends the same turn in the area saves once (the SRD text gives two saves).
   */
  it('places only the zone: no cast-time area save beside it', () => {
    expect(insectPlague.effects?.[0]?.paths).toHaveLength(1)
    expect(insectPlague.effects?.[0]?.invocation).not.toHaveProperty('savingThrow')
  })
})

const TURN_TRIGGER_TEXT =
  /\b(starts?|ends?) (its|his|her|their|a) turn\b|\b(start|end) of (its|their) turn\b/i

/** Every labelled subject whose description is prose, with the interaction kinds its components author. */
function describedZones(node: unknown): { label: string; description: string; kinds: string[] }[] {
  if (Array.isArray(node)) return node.flatMap(describedZones)
  if (typeof node !== 'object' || node === null) return []
  const record = node as Record<string, unknown>
  const own =
    typeof record.kind === 'string' &&
    typeof record.label === 'string' &&
    typeof record.description === 'string'
      ? [
          {
            label: record.label,
            description: record.description,
            kinds: Object.values(interactionKindsByComponent(record)).flat()
          }
        ]
      : []
  return [...own, ...Object.values(record).flatMap(describedZones)]
}

/**
 * SPELLS-20.T4b2b: a zone whose text acts on a creature starting or ending its turn in the area
 * must author that trigger once its components are authored, or the turn stage never reaches it.
 */
describe('SRD zones with turn-trigger text author the turn trigger', () => {
  /** Zones whose outcomes a placed zone cannot yet run; each leaves the list when its rules gap closes. */
  const RULES_GAP = new Set(['Prismatic Wall'])
  const authored = describedZones(srdBaselineContent.subjects).filter(
    (subject) => subject.kinds.length > 0 && TURN_TRIGGER_TEXT.test(subject.description)
  )

  it('finds authored zones that mention a turn trigger', () => {
    expect(authored.length).toBeGreaterThan(0)
  })

  it('lists every such zone that lacks START_TURN_IN_SPACE and END_TURN_IN_SPACE', () => {
    expect(
      authored
        .filter(
          (subject) =>
            !RULES_GAP.has(subject.label) &&
            !subject.kinds.includes('START_TURN_IN_SPACE') &&
            !subject.kinds.includes('END_TURN_IN_SPACE')
        )
        .map((subject) => subject.label)
    ).toEqual([])
  })
})
