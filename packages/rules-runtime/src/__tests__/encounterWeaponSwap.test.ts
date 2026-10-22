import { describe, expect, it } from 'vitest'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareNativeCharacterActionState } from '../character/characterNativeActionResources.js'
import { discoverCharacterActionCapabilities } from '../characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../encounterActionEntryPointCompiler.js'
import { evaluateEncounterCharacterActionWieldConflict } from '../encounterWieldConflict.js'
import { evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

type PrepareInput = Parameters<typeof prepareNativeCharacterActionState>[0]
type CompiledEntry = Extract<PrepareInput['entry'], { schemaVersion: 4 }>

// A Fighter holding a Longsword and a Shield, with a Shortsword and a Greatsword carried: attacking
// with the Shortsword swaps it for the Longsword, through the real SRD policy and entry compiler.
const fighter = evaluateSrdCharacter({
  abilities: { STRENGTH: 16 },
  classes: [{ label: 'Fighter', level: 1 }],
  items: [
    { label: 'Longsword', equipped: true },
    { label: 'Shield', equipped: true },
    { label: 'Shortsword' },
    { label: 'Greatsword' }
  ]
})
const descriptors = discoverCharacterActionCapabilities({
  gameSystemId: SRD_SYSTEM_ID,
  candidates: fighter.facts.actionCandidates,
  conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id).sort(),
  abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code })),
  entryPoints: fighter.entryPoints
})
const entries = compileCharacterActionEntryPoints({
  gameSystemId: SRD_SYSTEM_ID,
  candidates: fighter.facts.actionCandidates,
  descriptors
})

function weaponAttack(label: string, grip: 'ONE_HANDED' | 'TWO_HANDED') {
  const { candidate } = itemAction(fighter, label, {
    attackKind: 'MELEE',
    grip,
    activation: 'ACTION'
  })
  const entry = entries.find(
    (compiled): compiled is CompiledEntry =>
      compiled.kind === 'CHARACTER_ACTION' &&
      compiled.schemaVersion === 4 &&
      compiled.compilation.kind === 'COMPILED' &&
      compiled.actionId === candidate.actionId
  )
  if (!entry) throw new Error(`The SRD ${label} attack must compile to a v4 entry.`)
  return { candidate, entry }
}

const prepare = ({ candidate, entry }: ReturnType<typeof weaponAttack>) =>
  prepareNativeCharacterActionState({
    entry,
    candidate,
    policyOutput: fighter.output,
    resourceUsage: [],
    inventory: [],
    itemUsage: [],
    characterId: '00000000-0000-4000-8000-00000000a301',
    expectedStreamVersion: 3,
    classLevels: fighter.facts.grantFoldFacts.base.classes,
    automationMode: 'ASSISTED',
    trackAmmunition: false,
    ammunition: null,
    overridable: false
  })

const wieldConflict = ({ candidate }: ReturnType<typeof weaponAttack>) =>
  evaluateEncounterCharacterActionWieldConflict({
    gameSystemId: DND5E_SYSTEM_ID,
    candidate,
    ruleFacts: fighter.facts,
    policyOutput: fighter.output
  })

describe('a weapon swap is free (D107, ATTACK-19.3)', () => {
  const held = weaponAttack('Longsword', 'ONE_HANDED')
  const swapped = weaponAttack('Shortsword', 'ONE_HANDED')

  it('attacks with the carried weapon on the same activation as the held one', () => {
    expect(held.candidate.equipment?.equipped).toBe(true)
    expect(swapped.candidate.equipment?.equipped).toBe(false)
    expect(swapped.candidate.mechanicFacts.invocation.activation).toEqual(
      held.candidate.mechanicFacts.invocation.activation
    )
  })

  it('spends no resource, item, spell or warning beyond the attack itself', () => {
    expect(prepare(swapped)).toMatchObject({
      resourceConsumption: null,
      itemConsumption: null,
      spellConsumption: null,
      ruleWarnings: []
    })
    expect(prepare(held)).toMatchObject({
      resourceConsumption: null,
      itemConsumption: null,
      spellConsumption: null,
      ruleWarnings: []
    })
  })

  it('stows no shield and costs no armor class when the swapped weapon is one-handed', () => {
    expect(wieldConflict(swapped)).toEqual({ kind: 'NONE' })
  })

  it('asks before a two-handed swap, which is the one case that stows the shield', () => {
    expect(wieldConflict(weaponAttack('Greatsword', 'TWO_HANDED'))).toMatchObject({
      kind: 'STOW_SHIELD'
    })
  })
})
