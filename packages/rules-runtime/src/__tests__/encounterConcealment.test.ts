import {
  SRD_PASSIVE_PERCEPTION_ID,
  SRD_PERCEPTION_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  concealmentsFoundBy,
  encounterConcealmentOf,
  isConcealedFrom,
  observersHiddenFrom,
  passiveSkillDefinitionId
} from '../encounterConcealment.js'
import { ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID } from '../encounterRollModeReasons.js'
import { concealmentRecord } from '../testing/concealmentFixture.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction
} from './encounterCreatureAction.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const HIDER_ID = testUuid(0xa1)
const SEEING_ID = testUuid(0xa2)
const FOOLED_ID = testUuid(0xa3)
const passiveScore = (rollMode: string) =>
  rollModeCapabilityRegistry.passiveScore({
    gameSystemId: DND5E_SYSTEM_ID,
    skillModifier: 3,
    rollMode
  })

const hiddenFrom = (...observerActorIds: string[]) =>
  concealmentRecord({
    encounterId: ENCOUNTER_ID,
    holderActorId: HIDER_ID,
    observerActorIds: observerActorIds.sort(),
    concealmentTotal: 15
  })

describe('concealment rules', () => {
  it('hides the roller from observers whose passive score its Stealth total beats, ties to the observer', () => {
    expect(
      observersHiddenFrom(15, [
        { actorId: testUuid(3), passiveScore: 16 },
        { actorId: testUuid(2), passiveScore: 15 },
        { actorId: testUuid(1), passiveScore: 14 }
      ])
    ).toEqual([testUuid(1)])
  })

  it('finds a concealment when the search total reaches its Stealth total, ties to the searcher', () => {
    const concealment = {
      ...encounterConcealmentOf([hiddenFrom(SEEING_ID)])!,
      holderActorId: HIDER_ID
    }
    const found = (searchTotal: number, searcherActorId = SEEING_ID) =>
      concealmentsFoundBy({ searcherActorId, searchTotal, concealments: [concealment] })
    expect(found(14)).toEqual([])
    expect(found(15)).toMatchObject([{ holderActorId: HIDER_ID, remainingObserverActorIds: [] }])
    expect(found(20, FOOLED_ID)).toEqual([])
  })

  it('builds a passive score on the skill its System authors for the passive', () => {
    expect(passiveSkillDefinitionId(srdSystemRecord, SRD_PASSIVE_PERCEPTION_ID)).toBe(
      SRD_PERCEPTION_SKILL_ID
    )
    expect(passiveScore('NORMAL')).toBe(13)
  })

  it('reads the authored skill link, not the passive code, and none when the System authors none', () => {
    const secondSkill = srdSystemRecord.skills[1]
    const passive = (skillDefinitionId: string | null) => ({
      id: SRD_PASSIVE_PERCEPTION_ID,
      code: 'PASSIVE_PERCEPTION',
      label: 'Passive Perception',
      abilityDefinitionId: srdSystemRecord.abilities[0]!.id,
      skillDefinitionId
    })
    expect(
      passiveSkillDefinitionId(
        { ...srdSystemRecord, passives: [passive(secondSkill!.id)] },
        SRD_PASSIVE_PERCEPTION_ID
      )
    ).toBe(secondSkill!.id)
    expect(
      passiveSkillDefinitionId(
        { ...srdSystemRecord, passives: [passive(null)] },
        SRD_PASSIVE_PERCEPTION_ID
      )
    ).toBeNull()
    expect(passiveSkillDefinitionId(srdSystemRecord, testUuid(0xa9))).toBeNull()
  })

  it('adds 5 to a passive score with advantage and removes 5 with disadvantage', () => {
    expect(passiveScore('ADVANTAGE')).toBe(18)
    expect(passiveScore('DISADVANTAGE')).toBe(8)
  })

  it('reads the frozen total and the observers a stored concealment still hides its holder from', () => {
    const record = hiddenFrom(FOOLED_ID, SEEING_ID)
    expect(encounterConcealmentOf([record])).toMatchObject({
      concealmentTotal: 15,
      observerActorIds: [SEEING_ID, FOOLED_ID].sort()
    })
    expect(isConcealedFrom([record], FOOLED_ID)).toBe(true)
    expect(isConcealedFrom([record], HIDER_ID)).toBe(false)
    expect(isConcealedFrom([], FOOLED_ID)).toBe(false)
  })

  it('is used up by the first attack roll and by nothing else', () => {
    const record = hiddenFrom(FOOLED_ID)
    expect(
      discoverEncounterEventHooks({
        effects: [record],
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: false, againstEnemy: false }]
      }).ended
    ).toEqual([record])
    expect(
      discoverEncounterEventHooks({
        effects: [record],
        events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
      }).ended
    ).toEqual([])
  })

  it('leaves an effect that lists neither event unconsumed by an attack', () => {
    const record = hiddenFrom(FOOLED_ID)
    const unlisted = {
      ...record,
      definition: {
        ...record.definition,
        recurrence: { ...record.definition.recurrence, consumeOnFirstEvents: [], endOnEvents: [] }
      }
    }
    expect(
      discoverEncounterEventHooks({
        effects: [unlisted],
        events: [{ kind: 'ACTION', attackRoll: true, spellCast: false, againstEnemy: false }]
      }).ended
    ).toEqual([])
  })
})

describe('attacking from hiding', () => {
  const volley = (observerActorIds: string[]) =>
    prepareCreatureAction({
      actor: creatureActor({
        id: HIDER_ID,
        label: 'Rogue',
        features: [quillVolley({ charges: 1, cost: 1, rangeFeet: 80 })]
      }),
      target: creatureActor({ id: FOOLED_ID, label: 'Wolf', features: [] }),
      featureId: QUILL_VOLLEY_ID,
      overridable: true,
      attackPerception: true,
      actorActiveEffects: [hiddenFrom(...observerActorIds)]
    })

  it('rolls with advantage against an observer the attacker is hidden from', async () => {
    const prepared = await volley([FOOLED_ID])
    expect(prepared.relationshipContributors.map(({ sourceId }) => sourceId)).toContain(
      ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID
    )
    const { execution } = await settleCreatureAction({ prepared, rolls: [5, 9] })
    expect(execution.d20).toMatchObject({ derivedRollMode: 'ADVANTAGE', selectedNatural: 10 })
  })

  it('rolls normally against an observer that sees the attacker', async () => {
    const prepared = await volley([SEEING_ID])
    expect(prepared.relationshipContributors.map(({ sourceId }) => sourceId)).not.toContain(
      ENCOUNTER_UNSEEN_ATTACKER_CONTRIBUTOR_SOURCE_ID
    )
  })
})
