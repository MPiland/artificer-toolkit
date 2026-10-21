import { jackal } from '@artificer-toolkit/source-data/srd/creatures/jackal.js'
import { SRD_SYSTEM_ID, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { characterFormCreatureView } from '../encounterActorForm.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import {
  characterActor,
  installedSrdCreature,
  srdCreatureActor
} from '../testing/dnd5eSrdEncounter.js'

const CHARACTER_ACTOR_ID = '00000000-0000-4000-8000-0000000d4001'
const CHARACTER_ID = '00000000-0000-4000-8000-0000000d4002'
const FORM_ACTOR_ID = '00000000-0000-4000-8000-0000000d4003'
const FORM_EFFECT_ID = '00000000-0000-4000-8000-0000000d4004'

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

const sheetCharacter = (() => {
  const actor = characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
  if (actor.kind !== 'CHARACTER') throw new Error('Expected a Character actor.')
  return actor
})()

/** The Character in the Jackal's form, as the Run holds it (D130 amendment). */
const wornCharacter = (() => {
  const creature = srdCreatureActor({
    id: FORM_ACTOR_ID,
    creature: installedSrdCreature(jackal)
  })
  if (creature.kind !== 'CREATURE' || !creature.sourceId || !creature.sourceRevision)
    throw new Error('Expected a Creature actor.')
  return {
    ...sheetCharacter,
    form: {
      effectId: FORM_EFFECT_ID,
      excessDamageCarriesOver: true,
      sourceId: creature.sourceId,
      sourceRevision: creature.sourceRevision,
      snapshot: creature.snapshot,
      currentHitPoints: creature.currentHitPoints,
      maxHitPoints: creature.maxHitPoints,
      tempHitPoints: 0
    }
  }
})()

describe('a Character in a creature form acts from the form stat block (SPELLS-28.T4d)', () => {
  it('presents the form as a Creature under the Character’s own identity, and only while the form lasts', () => {
    expect(characterFormCreatureView(sheetCharacter)).toBeNull()
    expect(characterFormCreatureView(wornCharacter)).toMatchObject({
      id: CHARACTER_ACTOR_ID,
      kind: 'CREATURE',
      sourceId: wornCharacter.form.sourceId,
      snapshot: wornCharacter.form.snapshot,
      currentHitPoints: wornCharacter.form.currentHitPoints
    })
  })

  it('resolves the form’s action as a Creature action of the Character actor', () => {
    const view = characterFormCreatureView(wornCharacter)!
    const bite = discoverEncounterFeatureActions({
      spells: new Map(),
      actor: view,
      conditionDefinitionIds,
      abilityDefinitions
    }).available.find(({ label }) => label.startsWith('Bite'))!

    const source = resolveEncounterActionSource({
      spells: new Map(),
      actor: wornCharacter,
      actionId: bite.actionId,
      gameSystemId: SRD_SYSTEM_ID,
      system: srdSystemRecord
    })

    expect(source).toMatchObject({ kind: 'CREATURE', actor: { id: CHARACTER_ACTOR_ID } })
    expect(source.actor.kind).toBe('CHARACTER')
    expect(source.kind === 'CREATURE' && source.capability.label).toBe(bite.label)
  })

  it('refuses a Sheet action while the Character wears the form, and offers it again without it', () => {
    const sheetActionId = '00000000-0000-4000-8000-0000000d40ff'
    expect(() =>
      resolveEncounterActionSource({
        spells: new Map(),
        actor: wornCharacter,
        actionId: sheetActionId,
        gameSystemId: SRD_SYSTEM_ID,
        system: srdSystemRecord
      })
    ).toThrow('stale')
    expect(() =>
      resolveEncounterActionSource({
        spells: new Map(),
        actor: sheetCharacter,
        actionId: sheetActionId,
        gameSystemId: SRD_SYSTEM_ID,
        system: srdSystemRecord
      })
    ).toThrow('Character action source is stale')
  })
})
