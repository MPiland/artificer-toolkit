import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { ammunitionCommandChoice } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { AmmunitionChoiceError } from '../encounterErrors.js'
import { evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'

type PrepareInput = Parameters<typeof prepareNativeCharacterActionState>[0]
type CompiledEntry = Extract<PrepareInput['entry'], { schemaVersion: 4 }>

// A Fighter with an equipped Longbow carrying plain Arrows and Arrows +1, through the real SRD
// policy and entry compiler.
const archer = evaluateSrdCharacter({
  abilities: { DEXTERITY: 16 },
  classes: [{ label: 'Fighter', level: 1 }],
  items: [
    { label: 'Longbow', equipped: true },
    { label: 'Arrows' },
    { label: 'Arrows +1' },
    { label: 'Shortsword' }
  ]
})
const { candidate, decision } = itemAction(archer, 'Longbow', { attackKind: 'RANGED' })
const compiledEntry = compileCharacterActionEntryPoints({
  gameSystemId: SRD_SYSTEM_ID,
  candidates: archer.facts.actionCandidates,
  descriptors: discoverCharacterActionCapabilities({
    gameSystemId: SRD_SYSTEM_ID,
    candidates: archer.facts.actionCandidates,
    conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
    entryPoints: archer.entryPoints
  })
}).find(
  (entry): entry is CompiledEntry =>
    entry.kind === 'CHARACTER_ACTION' &&
    entry.schemaVersion === 4 &&
    entry.compilation.kind === 'COMPILED' &&
    entry.actionId === candidate.actionId
)
if (!compiledEntry) throw new Error('The SRD Longbow attack must compile to a v4 entry.')
const entry: CompiledEntry = compiledEntry

const CHARACTER_ID = '00000000-0000-4000-8000-00000000a201'
const STREAM_VERSION = 7
const arrowsId = archer.itemInstanceId('Arrows')
const magicArrowsId = archer.itemInstanceId('Arrows +1')
const stock = (arrows: number, magicArrows = 0) => [
  ...(arrows > 0 ? [{ id: arrowsId, quantity: arrows }] : []),
  ...(magicArrows > 0 ? [{ id: magicArrowsId, quantity: magicArrows }] : [])
]

function fire(overrides: Partial<PrepareInput> = {}) {
  return prepareNativeCharacterActionState({
    entry,
    candidate,
    policyOutput: archer.output,
    resourceUsage: [],
    inventory: stock(20),
    itemUsage: [],
    characterId: CHARACTER_ID,
    expectedStreamVersion: STREAM_VERSION,
    classLevels: archer.facts.grantFoldFacts.base.classes,
    automationMode: 'ASSISTED',
    trackAmmunition: true,
    ammunition: { attacks: 1 },
    overridable: false,
    ...overrides
  })
}

const attackBonusOf = (prepared: ReturnType<typeof fire>) => prepared.actionMechanic.attackBonus
const baseBonus = decision.mechanic.attackBonus ?? 0

describe('the ammunition a weapon attack fires (ATTACK-19.4)', () => {
  it('fits each ammunition stack through the equipment its pieces descend from', () => {
    expect(
      candidate.equipment?.ammunitionStacks?.map(({ itemInstanceId }) => itemInstanceId)
    ).toEqual([arrowsId, magicArrowsId])
  })

  it('draws one piece of the only stack in stock', () => {
    expect(fire().itemConsumption).toEqual({
      characterId: CHARACTER_ID,
      itemInstanceId: arrowsId,
      beforeUsed: 0,
      afterUsed: 1,
      beforeQuantity: 20,
      afterQuantity: 19,
      expectedStreamVersion: STREAM_VERSION
    })
  })

  it('draws from the stack the command names', () => {
    const prepared = fire({
      inventory: stock(20, 5),
      itemUsage: [{ itemInstanceId: magicArrowsId, used: 2 }],
      ammunition: { itemInstanceId: magicArrowsId, attacks: 1 }
    })
    expect(prepared.ammunition?.itemInstanceId).toBe(magicArrowsId)
    expect(prepared.itemConsumption).toMatchObject({
      itemInstanceId: magicArrowsId,
      beforeUsed: 2,
      afterUsed: 3,
      beforeQuantity: 5,
      afterQuantity: 4
    })
  })

  it('asks which stack to fire when several are in stock and none is named', () => {
    expect(() => fire({ inventory: stock(20, 5) })).toThrow(AmmunitionChoiceError)
  })

  it('refuses a stack that does not fit the weapon', () => {
    expect(() =>
      fire({ ammunition: { itemInstanceId: archer.itemInstanceId('Shortsword'), attacks: 1 } })
    ).toThrow(AmmunitionChoiceError)
  })

  it('refuses the attack when no piece is left, and warns when the GM may override', () => {
    expect(() => fire({ inventory: [] })).toThrow('unavailable or stale')
    const overridden = fire({ inventory: [], overridable: true })
    expect(overridden.itemConsumption).toBeNull()
    expect(overridden.ruleWarnings).toEqual([
      { code: 'RESOURCE_UNAVAILABLE', message: 'No ammunition left.' }
    ])
  })

  it('draws the last piece without a warning', () => {
    const prepared = fire({ inventory: stock(1) })
    expect(prepared.itemConsumption).toMatchObject({ beforeQuantity: 1, afterQuantity: 0 })
    expect(prepared.ruleWarnings).toEqual([])
  })

  it('draws one piece per target of a Volley, and refuses one short of it', () => {
    expect(fire({ ammunition: { attacks: 3 } }).itemConsumption).toMatchObject({
      afterUsed: 3,
      afterQuantity: 17
    })
    expect(() => fire({ inventory: stock(2), ammunition: { attacks: 3 } })).toThrow(
      'unavailable or stale'
    )
    const overridden = fire({
      inventory: stock(2),
      ammunition: { attacks: 3 },
      overridable: true
    })
    expect(overridden.itemConsumption).toMatchObject({ afterUsed: 2, afterQuantity: 0 })
    expect(overridden.ruleWarnings).toEqual([
      { code: 'RESOURCE_UNAVAILABLE', message: 'Needs 3 pieces of ammunition, has 2.' }
    ])
  })

  it('draws one piece per creature a Volley command names, and one for a single target', () => {
    const [first, second, third] = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000b30${n}`)
    expect(
      ammunitionCommandChoice({
        kind: 'ACTORS',
        actorIds: [first, second, third],
        ammunitionItemInstanceId: arrowsId
      } as Parameters<typeof ammunitionCommandChoice>[0])
    ).toEqual({ itemInstanceId: arrowsId, attacks: 3 })
    expect(
      ammunitionCommandChoice({ kind: 'ACTOR', actorId: first } as Parameters<
        typeof ammunitionCommandChoice
      >[0])
    ).toEqual({ itemInstanceId: undefined, attacks: 1 })
  })

  it('applies the chosen ammunition bonus to the attack that fires it alone', () => {
    const plain = fire({
      inventory: stock(20, 5),
      ammunition: { itemInstanceId: arrowsId, attacks: 1 }
    })
    const magic = fire({
      inventory: stock(20, 5),
      ammunition: { itemInstanceId: magicArrowsId, attacks: 1 }
    })
    expect(attackBonusOf(plain)).toBe(baseBonus)
    expect(attackBonusOf(magic)).toBe(baseBonus + 1)
  })

  it('applies the bonus but counts nothing when the Campaign does not track ammunition', () => {
    const untracked = fire({
      trackAmmunition: false,
      inventory: stock(20, 5),
      ammunition: { itemInstanceId: magicArrowsId, attacks: 1 }
    })
    expect(untracked.itemConsumption).toBeNull()
    expect(attackBonusOf(untracked)).toBe(baseBonus + 1)
    expect(fire({ trackAmmunition: false, inventory: [] }).ruleWarnings).toEqual([])
  })

  it('leaves the count and the bonus to the table in Manual play', () => {
    const manual = fire({
      automationMode: 'MANUAL',
      inventory: stock(20, 5),
      ammunition: { itemInstanceId: magicArrowsId, attacks: 1 }
    })
    expect(manual.itemConsumption).toBeNull()
    expect(attackBonusOf(manual)).toBe(baseBonus)
  })

  it('previews the first stack in stock for a read that names none', () => {
    expect(fire({ ammunition: null, inventory: stock(20, 5) }).ammunition?.itemInstanceId).toBe(
      arrowsId
    )
  })
})
