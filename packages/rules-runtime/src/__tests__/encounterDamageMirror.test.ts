import { describe, expect, it } from 'vitest'
import { damageDispositionOf } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { wardingBond } from '@artificer-toolkit/source-data/srd/spells/warding-bond.js'
import { SRD_DAMAGE_TYPES, SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  damageMirrorMechanicsBatch,
  heldDamageMirrors,
  pendingDamageMirrors
} from '../encounterDamageMirror.js'
import type { ReceiptApplications } from '../encounterCharacterMechanicsBatch.js'
import { buildMovementTarget } from '../encounterMovementTargets.js'
import { ENCOUNTER_ID, srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'
import { antitoxinEffect, plannedGrantEffect } from './antitoxinEffectFixture.js'

const HOLDER_ID = '00000000-0000-4000-8000-00000000d101'
const SOURCE_ID = '00000000-0000-4000-8000-00000000d102'
const BOND_ID = '00000000-0000-4000-8000-00000000d103'
const OTHER_BOND_ID = '00000000-0000-4000-8000-00000000d104'
const CAMPAIGN_ID = '00000000-0000-4000-8000-00000000d105'
const PIERCING = SRD_DAMAGE_TYPES.find(({ code }) => code === 'PIERCING')!.id
const FIRE = SRD_DAMAGE_TYPES.find(({ code }) => code === 'FIRE')!.id

const wolf = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Wolf')!

const bond = (id: string, sourceActorId = SOURCE_ID, holderActorId = HOLDER_ID) =>
  plannedGrantEffect({
    id,
    holderActorId,
    effect: wardingBond.effects?.[0],
    sourceLabel: wardingBond.label,
    sourceActorId
  })

const damage = (
  damageTypeId: string,
  resolvedAmount: number,
  mirrored?: true
): ReceiptApplications[number] =>
  ({
    kind: 'DAMAGE',
    damageTypeId,
    resolvedAmount,
    ...(mirrored && { mirrored })
  }) as ReceiptApplications[number]

describe('held damage mirrors (SPELLS-4.T2n4)', () => {
  it('lists each Warding Bond with its source, lowest effect id first, and ignores other grants', () => {
    const effects = [
      bond(OTHER_BOND_ID, SOURCE_ID),
      antitoxinEffect({ id: BOND_ID, holderActorId: HOLDER_ID }),
      bond(BOND_ID)
    ]
    expect(heldDamageMirrors(effects)).toEqual([
      { effectId: BOND_ID, sourceActorId: SOURCE_ID },
      { effectId: OTHER_BOND_ID, sourceActorId: SOURCE_ID }
    ])
  })

  it('passes on what the holder took after its defenses, never mirrored damage, never to itself', () => {
    const mirrors = [{ effectId: BOND_ID, sourceActorId: SOURCE_ID }]
    const applications = [
      damage(PIERCING, 4),
      damage(FIRE, 0),
      damage(FIRE, 3, true),
      { kind: 'HEALING' } as ReceiptApplications[number]
    ]
    expect(pendingDamageMirrors({ holderActorId: HOLDER_ID, mirrors, applications })).toEqual([
      { ...mirrors[0], damageTypeId: PIERCING, amount: 4 }
    ])
    expect(
      pendingDamageMirrors({
        holderActorId: SOURCE_ID,
        mirrors,
        applications: [damage(PIERCING, 4)]
      })
    ).toEqual([])
  })
})

describe('the mirror batch (SPELLS-4.T2n4)', () => {
  const source = srdCreatureActor({ id: SOURCE_ID, creature: wolf, currentHitPoints: 10 })
  const sourceTarget = (activeEffects = [] as ReturnType<typeof bond>[]) =>
    buildMovementTarget({
      actor: source,
      activeEffects,
      gameSystemId: SRD_SYSTEM_ID,
      campaignId: CAMPAIGN_ID,
      characterFacts: null
    })
  const batch = (target: ReturnType<typeof sourceTarget>, amounts: number[]) =>
    damageMirrorMechanicsBatch({
      state: { id: ENCOUNTER_ID, version: 7 },
      target,
      mirrors: amounts.map((amount) => ({
        effectId: BOND_ID,
        sourceActorId: SOURCE_ID,
        damageTypeId: PIERCING,
        amount
      })),
      ordinal: 0,
      occurrenceId: '00000000-0000-4000-8000-00000000d106',
      rootCommandId: '00000000-0000-4000-8000-00000000d107',
      occurredAt: '2026-10-22T00:00:00.000Z'
    })

  it('marks every application mirrored and chains them through the source’s hit points', () => {
    const { applications, commandId, sourceCommandId, expectedEncounterVersion } = batch(
      sourceTarget(),
      [4, 3]
    )
    expect(commandId).toBe(sourceCommandId)
    expect(expectedEncounterVersion).toBe(7)
    expect(applications).toMatchObject([
      { kind: 'DAMAGE', mirrored: true, beforeCurrentHitPoints: 10, afterCurrentHitPoints: 6 },
      { kind: 'DAMAGE', mirrored: true, beforeCurrentHitPoints: 6, afterCurrentHitPoints: 3 }
    ])
  })

  it('applies the source’s own defenses after the holder’s', () => {
    const target = sourceTarget([bond(OTHER_BOND_ID, HOLDER_ID, SOURCE_ID)])
    expect(damageDispositionOf(target.defenses, PIERCING)).toBe('RESISTANT')
    const [application] = batch(target, [4]).applications
    expect(application).toMatchObject({
      requestedAmount: 4,
      resolvedAmount: 2,
      afterCurrentHitPoints: 8
    })
  })
})
