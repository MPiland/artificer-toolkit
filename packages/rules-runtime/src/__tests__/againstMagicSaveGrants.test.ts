import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_ABILITIES, SRD_SPEEDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { conditionTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'

import {
  conditionImmunityIdsAgainstSource,
  encounterSourceConditionImmunities,
  encounterSourceSaves,
  withSourceSaves,
  type EncounterHolderState
} from '../encounterActiveGrants.js'
import { withEncounterHolderDefense } from '../encounterHolderDefense.js'
import { buildMovementTarget, type MovementTarget } from '../encounterMovementTargets.js'
import { selectDnd5eTargetSavingThrow } from '../systems/dnd5e/effectActionCompiler.js'
import {
  CAMPAIGN_ID,
  SRD_SYSTEM_ID,
  srdCreatureActor,
  srdDefinitions,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, evaluateSrdCharacter, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

/**
 * The "against magic" and "against poison" save qualifiers (SPELLS-33.T4j, SPELLS-32.T4j): grants
 * limited to a magical source (D179) or scoped to the POISONED condition, authored from core options.
 */
const HOLDER_ID = testUuid(0xd7a1)
const NONMAGICAL = { creatureTypeIds: [] }
const MAGICAL = { creatureTypeIds: [], traits: ['MAGICAL' as const] }
const unconscious = conditionTypeId('UNCONSCIOUS')
const poisoned = conditionTypeId('POISONED')
const charmed = conditionTypeId('CHARMED')

const holderState = (kind: EncounterHolderState['kind']): EncounterHolderState => ({
  kind,
  creatureTypeIds: [],
  canAct: true,
  speedAboveZero: true,
  freeHand: true,
  stowableHeldItemInstanceId: null,
  turnMovement: { usedFeet: 0, speedFeet: 30 }
})

const creatureHolder = (creature: CreatureAuthored) =>
  withEncounterHolderDefense({
    target: buildMovementTarget({
      actor: srdCreatureActor({ id: HOLDER_ID, creature }),
      activeEffects: [],
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    }),
    gameSystemId: SRD_SYSTEM_ID,
    definitions: srdDefinitions,
    speedDefinitions: SRD_SPEEDS,
    runEffectsByActorId: new Map(),
    readTurnMovedFeet: async () => 0
  })

/** The roll mode of the holder's save of `ability` against a source, with no condition named. */
function saveMode(
  target: Pick<MovementTarget, 'targetDerivedFacts' | 'sourceSaves'>,
  ability: string,
  source: typeof NONMAGICAL | typeof MAGICAL,
  spellCastSystemId: string | null = null,
  conditionIds: string[] = []
) {
  const facts = withSourceSaves(
    SRD_SYSTEM_ID,
    target.targetDerivedFacts,
    target.sourceSaves,
    source,
    spellCastSystemId
  )
  return selectDnd5eTargetSavingThrow({
    savingThrowDefinitions: facts.savingThrowDefinitions as unknown[],
    abilityDefinitionId: SRD_ABILITIES.find(({ code }) => code === ability)!.id,
    conditionIds
  }).rollMode
}

describe('Magic Resistance on SRD Creatures', () => {
  const archmage = srdByLabel(SRD.creatures, 'Archmage')

  it('gives no unconditional save advantage', async () => {
    const target = await creatureHolder(archmage)
    for (const { code } of SRD_ABILITIES) {
      expect(
        selectDnd5eTargetSavingThrow({
          savingThrowDefinitions: target.targetDerivedFacts.savingThrowDefinitions as unknown[],
          abilityDefinitionId: SRD_ABILITIES.find((ability) => ability.code === code)!.id,
          conditionIds: []
        }).rollMode
      ).toBe('NORMAL')
    }
  })

  it('gives advantage on every save against a spell or other magical effect only', async () => {
    const target = await creatureHolder(archmage)
    expect(target.sourceSaves).toHaveLength(SRD_ABILITIES.length)
    for (const { code } of SRD_ABILITIES) {
      expect(saveMode(target, code, MAGICAL)).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL, SRD_SYSTEM_ID)).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
    }
  })

  it('a homebrew Creature authored from the same grants saves exactly like the Archmage', async () => {
    const goblin = srdByLabel(SRD.creatures, 'Goblin')
    const resistance = archmage.features.find((feature) => feature.label === 'Magic Resistance')
    if (!resistance?.grants?.modifiers) throw new Error('Magic Resistance grants nothing.')
    const homebrew: CreatureAuthored = {
      ...goblin,
      id: testUuid(0xd7b0),
      features: [
        ...goblin.features,
        {
          id: testUuid(0xd7b1),
          label: 'Homebrew Warding',
          description: 'Warded against magic.',
          order: 99,
          grants: { modifiers: resistance.grants.modifiers }
        }
      ]
    }
    const target = await creatureHolder(homebrew)
    for (const { code } of SRD_ABILITIES) {
      expect(saveMode(target, code, MAGICAL)).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
    }
  })
})

describe('Creature save qualifiers', () => {
  it('Deep Gnome Gnome Cunning: Intelligence, Wisdom and Charisma saves against magic only', async () => {
    const target = await creatureHolder(srdByLabel(SRD.creatures, 'Deep Gnome (Svirfneblin)'))
    for (const code of ['INTELLIGENCE', 'WISDOM', 'CHARISMA'])
      expect(saveMode(target, code, MAGICAL)).toBe('ADVANTAGE')
    for (const code of ['STRENGTH', 'DEXTERITY', 'CONSTITUTION'])
      expect(saveMode(target, code, MAGICAL)).toBe('NORMAL')
    expect(saveMode(target, 'WISDOM', NONMAGICAL)).toBe('NORMAL')
  })

  it('Duergar Resilience: saves against poison, charm, paralysis and magic', async () => {
    const target = await creatureHolder(srdByLabel(SRD.creatures, 'Duergar'))
    for (const { code } of SRD_ABILITIES) {
      expect(saveMode(target, code, MAGICAL)).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
      for (const condition of ['POISONED', 'CHARMED', 'PARALYZED'])
        expect(saveMode(target, code, NONMAGICAL, null, [conditionTypeId(condition)])).toBe(
          'ADVANTAGE'
        )
    }
  })

  it.each(['Drider', 'Drow'])(
    '%s Fey Ancestry: advantage against charm, and magic cannot put it to sleep',
    async (label) => {
      const target = await creatureHolder(srdByLabel(SRD.creatures, label))
      expect(saveMode(target, 'WISDOM', NONMAGICAL, null, [charmed])).toBe('ADVANTAGE')
      expect(target.conditionImmunityIds).not.toContain(unconscious)
      const against = (source: typeof NONMAGICAL | typeof MAGICAL, spellCast: string | null) => [
        ...conditionImmunityIdsAgainstSource(
          target.conditionImmunityIds,
          target.sourceConditionImmunities,
          source,
          spellCast
        )
      ]
      expect(against(MAGICAL, null)).toContain(unconscious)
      expect(against(NONMAGICAL, SRD_SYSTEM_ID)).toContain(unconscious)
      expect(against(NONMAGICAL, null)).not.toContain(unconscious)
    }
  )
})

describe('race save qualifiers on Characters', () => {
  const character = (race: string, subrace: string) =>
    evaluateSrdCharacter({ race, subrace, classes: [{ label: 'Fighter', level: 1 }] })
  const characterTarget = (output: ReturnType<typeof character>['output']) => ({
    targetDerivedFacts: { savingThrowDefinitions: output.savingThrowDefinitions },
    sourceSaves: encounterSourceSaves({
      gameSystemId: SRD_SYSTEM_ID,
      holderActorId: HOLDER_ID,
      effects: [],
      featureGrants: output.grantFold,
      holderState: holderState('CHARACTER')
    })
  })

  it('Gnome Cunning: Intelligence, Wisdom and Charisma saves against magic only, off the Sheet', () => {
    const { output } = character('Gnome', 'Rock Gnome')
    const target = characterTarget(output)
    for (const code of ['INTELLIGENCE', 'WISDOM', 'CHARISMA']) {
      expect(saveMode(target, code, MAGICAL)).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
      expect(output.rollModes.savingThrows[code as 'WISDOM']).toBe('NORMAL')
    }
    expect(saveMode(target, 'DEXTERITY', MAGICAL)).toBe('NORMAL')
  })

  it.each([
    ['Elf', 'High Elf'],
    ['Half-Elf', undefined]
  ])('%s Fey Ancestry: advantage against charm, and magic cannot put it to sleep', (race, sub) => {
    const { output } = evaluateSrdCharacter({
      race,
      ...(sub === undefined ? {} : { subrace: sub }),
      classes: [{ label: 'Fighter', level: 1 }]
    })
    const target = characterTarget(output)
    for (const { code } of SRD_ABILITIES) {
      expect(saveMode(target, code, NONMAGICAL, null, [charmed])).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
    }
    expect(output.conditionImmunityIds).not.toContain(unconscious)
    const immunities = encounterSourceConditionImmunities({
      effects: [],
      grantFold: output.grantFold,
      holderState: holderState('CHARACTER')
    })
    const against = (source: typeof NONMAGICAL | typeof MAGICAL) => [
      ...conditionImmunityIdsAgainstSource(output.conditionImmunityIds, immunities, source, null)
    ]
    expect(against(MAGICAL)).toContain(unconscious)
    expect(against(NONMAGICAL)).not.toContain(unconscious)
  })

  it('Dwarven Resilience: advantage on saves against poison, and poison resistance', () => {
    const { output } = character('Dwarf', 'Hill Dwarf')
    const target = characterTarget(output)
    for (const { code } of SRD_ABILITIES) {
      expect(saveMode(target, code, NONMAGICAL, null, [poisoned])).toBe('ADVANTAGE')
      expect(saveMode(target, code, NONMAGICAL)).toBe('NORMAL')
    }
    expect(output.defenses.map(({ kind }) => kind)).toContain('RESISTANCE')
  })
})
