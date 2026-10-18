import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { ballBearingsBagOf1000 } from './equipment/ball-bearings-bag-of-1000.js'
import { caltropsBagOf20 } from './equipment/caltrops-bag-of-20.js'
import { huntingTrap } from './equipment/hunting-trap.js'
import { oilFlask } from './equipment/oil-flask.js'
import type { SpellAuthored } from '@artificer-toolkit/shared'
import { blackTentacles } from './spells/black-tentacles.js'
import { bladeBarrier } from './spells/blade-barrier.js'
import { cloudkill } from './spells/cloudkill.js'
import { grease } from './spells/grease.js'
import { incendiaryCloud } from './spells/incendiary-cloud.js'
import { insectPlague } from './spells/insect-plague.js'
import { moonbeam } from './spells/moonbeam.js'
import { sleetStorm } from './spells/sleet-storm.js'
import { spiritGuardians } from './spells/spirit-guardians.js'
import { stinkingCloud } from './spells/stinking-cloud.js'
import { web } from './spells/web.js'
import { damageTypeId } from './spells/shared.js'

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
    ['Blade Barrier', bladeBarrier, 'Whirling Blades'],
    ['Grease', grease, 'Enter the grease'],
    ['Sleet Storm', sleetStorm, 'Enter the sleet storm'],
    ['Web', web, 'Enter the webs'],
    ['Black Tentacles', blackTentacles, 'Enter the tentacles']
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

  it.each([
    ['Spirit Guardians', spiritGuardians, 'Enter the spirits', 'START_TURN_IN_SPACE'],
    ['Cloudkill', cloudkill, 'Enter the poisonous fog', 'START_TURN_IN_SPACE'],
    ['Insect Plague', insectPlague, 'Enter the locust swarm', 'END_TURN_IN_SPACE'],
    ['Moonbeam', moonbeam, 'Enter the moonlight', 'START_TURN_IN_SPACE'],
    ['Incendiary Cloud', incendiaryCloud, 'Enter the burning cloud', 'END_TURN_IN_SPACE']
  ])(
    'catches a creature of %s on entering or passing through the area and at its turn boundary (SPELLS-4.T1f)',
    (_name, spell, component, turnTrigger) => {
      expect(interactionKindsByComponent(spell)[component]).toEqual([
        'ENTER_OR_PASS_THROUGH',
        turnTrigger
      ])
    }
  )
  it('knocks a creature of Grease prone on ending its turn in the grease, and of Sleet Storm on starting it in the storm', () => {
    expect(interactionKindsByComponent(grease)['Enter the grease']).toContain('END_TURN_IN_SPACE')
    expect(interactionKindsByComponent(sleetStorm)['Enter the sleet storm']).toContain(
      'START_TURN_IN_SPACE'
    )
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
 * SPELLS-4.T1a, T1c, T1d and SPELLS-20.T4b3a: SRD rules of the hazard zones a placed zone cannot run yet. The zone
 * compiler refuses any authored option it does not model, so each stays unauthored (the zone then
 * still compiles) and leaves this list when a task models it (registration is the orchestrator's).
 */
describe('SRD hazard zone rules a placed zone does not run yet (SPELLS-4.T1a, T1c, T1d, SPELLS-20.T4b3a)', () => {
  const zoneGaps = [
    { spell: cloudkill, rule: 'heavily obscured area', option: 'obscurementKind' },
    { spell: cloudkill, rule: 'fog spreads around corners', option: 'spreadsAroundCorners' },
    { spell: insectPlague, rule: 'lightly obscured area', option: 'obscurementKind' },
    { spell: insectPlague, rule: 'swarm spreads around corners', option: 'spreadsAroundCorners' },
    { spell: incendiaryCloud, rule: 'heavily obscured area', option: 'obscurementKind' },
    {
      spell: incendiaryCloud,
      rule: 'cloud spreads around corners',
      option: 'spreadsAroundCorners'
    },
    { spell: moonbeam, rule: 'dim light filling the cylinder', option: 'light' },
    { spell: sleetStorm, rule: 'heavily obscured area', option: 'obscurementKind' },
    { spell: stinkingCloud, rule: 'heavily obscured area', option: 'obscurementKind' },
    { spell: stinkingCloud, rule: 'cloud spreads around corners', option: 'spreadsAroundCorners' },
    { spell: stinkingCloud, rule: 'wind dispersal', option: 'destructionCriteria' },
    { spell: web, rule: 'lightly obscured area', option: 'obscurementKind' },
    { spell: web, rule: 'webs burning away in fire', option: 'destructionCriteria' }
  ] as const
  it.each(zoneGaps)(
    '$spell.label: the $rule is unauthored ($option, no task yet)',
    ({ spell, option }) => {
      expect(placedZoneOf(spell)).not.toHaveProperty(option)
    }
  )

  it.each([
    ['Insect Plague', insectPlague],
    ['Grease', grease],
    ['Sleet Storm', sleetStorm],
    ['Web', web],
    ['Black Tentacles', blackTentacles]
  ])(
    'leaves %s’s difficult terrain unauthored on its component (movementCostMultiplier, SPELLS-20.T4d)',
    (_name, spell) => {
      expect(placedZoneOf(spell).components?.[0]).not.toHaveProperty('movementCostMultiplier')
    }
  )

  // D141: no creature fact says a creature does not breathe; the rider is a deferred edge case.
  it('authors Stinking Cloud’s automatic success only for immunity to poison damage', () => {
    expect(placedZoneOf(stinkingCloud).components?.[0]).toMatchObject({
      automaticSaveSuccessImmunityDamageTypeId: damageTypeId('POISON')
    })
  })

  /**
   * Not authorable at all yet, so nothing in the record can show them: Cloudkill's fog moving 10
   * feet away from the caster at the start of each of the caster's turns and sinking to the lowest
   * ground, strong wind dispersing it, and Insect Plague's and Grease's save for each creature in the area
   * when it appears (a cast that places a zone has no cast-time area save). Incendiary Cloud's cloud
   * moving 10 feet away from the caster at the start of each of the caster's turns, its wind
   * dispersal and its save when it appears, and Moonbeam's beam moved 60 feet by the caster's
   * action. Each needs a new core option. Moonbeam's shapechanger rider (disadvantage on the save,
   * reverting to its original form on a failure and no new form while in the light) needs a
   * creature-trait condition on a zone save and a creature form state, which the save contract
   * does not have. Also not exact: the per-turn limit counts every application, so an Insect
   * Plague or Incendiary Cloud creature that enters and ends the same turn in the area saves once
   * (the SRD text gives two saves). Sleet Storm's Constitution save to keep Concentration for a
   * creature concentrating in the area, and its dousing of exposed flames, need a zone save that
   * targets a maintained effect and a light-source state, which no core option has.
   */
  it.each([
    ['Insect Plague', insectPlague],
    ['Incendiary Cloud', incendiaryCloud],
    ['Grease', grease]
  ])('%s places only the zone: no cast-time area save beside it', (_name, spell) => {
    expect(spell.effects?.[0]?.paths).toHaveLength(1)
    expect(spell.effects?.[0]?.invocation).not.toHaveProperty('savingThrow')
  })

  it('authors Moonbeam’s save without a shapechanger condition', () => {
    const invocation = placedZoneOf(moonbeam).components?.[0]?.behaviors?.[0]?.invocation
    if (!invocation || !('savingThrow' in invocation) || !invocation.savingThrow)
      throw new Error('Moonbeam must author a zone save.')
    expect(Object.keys(invocation.savingThrow).sort()).toEqual([
      'abilityDefinitionId',
      'dcMethod',
      'id'
    ])
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

/**
 * SPELLS-4.T1f: the SRD's "enters the area" includes a move that passes through it (SPELLS-17.5), so
 * no zone whose text says a creature enters its area may author ENTER_SPACE, which fires only when a
 * move ends inside.
 */
describe('SRD zones whose text says a creature enters the area', () => {
  const ENTERS_THE_AREA = /\benters\b[^.]*\barea\b/i
  const entered = describedZones(srdBaselineContent.subjects).filter(
    (subject) => subject.kinds.length > 0 && ENTERS_THE_AREA.test(subject.description)
  )

  it('finds authored zones that a creature enters', () => {
    expect(entered.length).toBeGreaterThan(0)
  })

  it('lists every such zone that authors ENTER_SPACE', () => {
    expect(
      entered.filter((subject) => subject.kinds.includes('ENTER_SPACE')).map(({ label }) => label)
    ).toEqual([])
  })
})
