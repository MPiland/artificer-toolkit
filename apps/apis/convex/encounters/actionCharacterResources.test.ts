import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  encodeCharacterRecord,
  readCharacterSheetState
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { prepareNativeCharacterActionState } from '@artificer-toolkit/rules-runtime/character/characterNativeActionResources'
import {
  applyEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../../tests/fixtures/mechanicsBatch'

function command(
  fixture: Awaited<ReturnType<typeof setupCharacterRun>>
): Omit<EncounterMechanicsBatchInput, 'applications'> {
  return {
    encounterId: fixture.run.id,
    targetActorId: fixture.actor.id,
    expectedEncounterVersion: fixture.run.version,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    effectiveMaximumHitPoints: fixture.actor.maxHitPoints,
    expectedCharacterStreamVersion: fixture.characterStreamVersion,
    forceVersionAdvance: false
  }
}

function resourceConsumption(input: {
  characterId: string
  expectedStreamVersion: number
  usageId: string
  beforeUsed?: number
}) {
  const owner = {
    kind: 'AUTHORED_GRANT' as const,
    resourceGrantId: crypto.randomUUID()
  }
  const beforeUsed = input.beforeUsed ?? 0
  return {
    poolId: createCharacterResourceOwnerKey(owner),
    chargeId: crypto.randomUUID(),
    cost: 1,
    owner,
    usageId: input.usageId,
    beforeUsed,
    afterUsed: beforeUsed + 1,
    beforeRemaining: 2 - beforeUsed,
    afterRemaining: 1 - beforeUsed,
    characterId: input.characterId,
    expectedStreamVersion: input.expectedStreamVersion
  }
}

function damage(input: { actorId: string; current: number; temporary: number; maximum: number }) {
  return {
    sourceNodeId: 'native-resource-test',
    sourceOperationKey: 'damage',
    authoredPath: null,
    resolvedPath: 'TEST',
    kind: 'DAMAGE' as const,
    targetActorId: input.actorId,
    requestedAmount: 1,
    resolvedAmount: 1,
    appliedAmount: 1,
    beforeCurrentHitPoints: input.current,
    afterCurrentHitPoints: input.current - 1,
    beforeTemporaryHitPoints: input.temporary,
    afterTemporaryHitPoints: input.temporary,
    maximumHitPoints: input.maximum,
    damageTypeId: crypto.randomUUID(),
    damageDisposition: 'NORMAL' as const,
    critical: false
  }
}

async function read(fixture: Awaited<ReturnType<typeof setupCharacterRun>>) {
  return fixture.t.run(async (ctx) => {
    const [character, actor] = await Promise.all([
      readCharacterRow(ctx, fixture.character.id),
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', fixture.run.id).eq('id', fixture.actor.id)
        )
        .unique()
    ])
    return { character, actor }
  })
}

describe('native Character action resource persistence', () => {
  it('preflights a current compiler-backed Character action resource and rejects stale raw usage', async () => {
    const chargeId = crypto.randomUUID()
    const feature = wolf.features?.find((value) => value.label === 'Bite')
    const effect = structuredClone(feature?.effects?.[0])
    if (!feature || !effect || effect.invocation.kind !== 'ACTION')
      throw new Error('Expected an action fixture effect.')
    effect.invocation.resourceUse = { chargeId, cost: 1 }
    const base = await readyCharacterFixture({
      resources: {
        id: crypto.randomUUID(),
        label: 'Native action resource',
        order: 0,
        availableAtLevel: 1,
        charges: {
          id: chargeId,
          resetKind: 'SHORT_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 2
        }
      },
      features: [
        {
          ...structuredClone(feature),
          id: crypto.randomUUID(),
          availableAtLevel: 1,
          effects: [effect]
        }
      ]
    })
    const { draft, character } = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const result = await base.t.run(async (ctx) => {
      const current = await loadCharacterSheetFacts(ctx, base.owner.userId, character.id)
      if (!current) throw new Error('Missing current Character facts.')
      const conditionDefinitionIds = (
        current.prepared.context.registry.system?.conditionTypes ?? []
      )
        .map((condition) => condition.id)
        .sort()
      const candidate = current.ruleEvaluation.facts.actionCandidates.find(
        (value) => value.resourceUse?.chargeId === chargeId
      )
      const entry = compileCharacterActionEntryPoints({
        gameSystemId: character.systemId,
        candidates: current.ruleEvaluation.facts.actionCandidates,
        descriptors: discoverCharacterActionCapabilities({
          gameSystemId: character.systemId,
          candidates: current.ruleEvaluation.facts.actionCandidates,
          conditionDefinitionIds,
          abilityDefinitions: current.ruleEvaluation.facts.abilityDefinitions,
          entryPoints: current.ruleEvaluation.actionEntryPoints
        })
      }).find(
        (value) =>
          value.kind === 'CHARACTER_ACTION' &&
          value.schemaVersion === 4 &&
          value.actionId === candidate?.actionId
      )
      if (!entry || entry.kind !== 'CHARACTER_ACTION' || entry.schemaVersion !== 4 || !candidate)
        throw new Error('Missing current compiler-backed resource action.')
      const prepared = prepareNativeCharacterActionState({
        entry,
        candidate,
        policyOutput: current.ruleEvaluation.output,
        resourceUsage: current.sheetState.resourceUsage,
        characterId: character.id,
        inventory: [],
        itemUsage: [],
        expectedStreamVersion: current.active.play.streamVersion,
        classLevels: current.ruleEvaluation.facts.grantFoldFacts.base.classes,
        automationMode: 'ASSISTED',
        trackAmmunition: false,
        ammunition: null,
        overridable: false
      })
      if (!prepared.resourceConsumption) throw new Error('Missing resource consumption.')
      const binding = entry.compilation.resourceBinding
      if (!binding) throw new Error('Missing compiled resource binding.')
      expect(() =>
        prepareNativeCharacterActionState({
          entry: {
            ...entry,
            compilation: {
              ...entry.compilation,
              resourceBinding: { ...binding, cost: binding.cost + 1 }
            }
          },
          candidate,
          policyOutput: current.ruleEvaluation.output,
          resourceUsage: current.sheetState.resourceUsage,
          characterId: character.id,
          inventory: [],
          itemUsage: [],
          expectedStreamVersion: current.active.play.streamVersion,
          classLevels: current.ruleEvaluation.facts.grantFoldFacts.base.classes,
          automationMode: 'ASSISTED',
          trackAmmunition: false,
          ammunition: null,
          overridable: false
        })
      ).toThrow('unavailable or stale')
      let staleRawUsageRefused = false
      try {
        prepareNativeCharacterActionState({
          entry,
          candidate,
          policyOutput: current.ruleEvaluation.output,
          resourceUsage: [
            {
              id: crypto.randomUUID(),
              characterId: character.id,
              owner: prepared.resourceConsumption.owner,
              used: 1,
              createdBy: base.owner.userId,
              updatedBy: base.owner.userId,
              createdAt: '2026-09-12T00:00:00.000Z',
              updatedAt: '2026-09-12T00:00:00.000Z'
            }
          ],
          characterId: character.id,
          inventory: [],
          itemUsage: [],
          expectedStreamVersion: current.active.play.streamVersion,
          classLevels: current.ruleEvaluation.facts.grantFoldFacts.base.classes,
          automationMode: 'ASSISTED',
          trackAmmunition: false,
          ammunition: null,
          overridable: false
        })
      } catch (error) {
        staleRawUsageRefused = error instanceof Error && /unavailable or stale/.test(error.message)
      }
      // Assisted RESOLVE_ACTION reports an exhausted pool or an unequipped source as a warning.
      const output = current.ruleEvaluation.output
      const decide = (
        change: Pick<
          (typeof output.actionDecisions)[number],
          'status' | 'reasonCode' | 'resourcePoolId' | 'resourceCost'
        >
      ) => ({
        ...output,
        actionDecisions: output.actionDecisions.map((value) =>
          value.actionId === candidate.actionId ? { ...value, ...change } : value
        )
      })
      const exhausted = {
        entry,
        candidate,
        policyOutput: {
          ...decide({
            status: 'UNAVAILABLE',
            reasonCode: 'INSUFFICIENT_RESOURCE',
            resourcePoolId: binding.poolId,
            resourceCost: binding.cost
          }),
          resources: output.resources.map((value) =>
            value.poolId === binding.poolId ? { ...value, rawUsed: 2, remaining: 0 } : value
          )
        },
        resourceUsage: [
          {
            id: crypto.randomUUID(),
            characterId: character.id,
            owner: prepared.resourceConsumption.owner,
            used: 2,
            createdBy: base.owner.userId,
            updatedBy: base.owner.userId,
            createdAt: '2026-09-12T00:00:00.000Z',
            updatedAt: '2026-09-12T00:00:00.000Z'
          }
        ],
        characterId: character.id,
        inventory: [],
        itemUsage: [],
        expectedStreamVersion: current.active.play.streamVersion,
        classLevels: current.ruleEvaluation.facts.grantFoldFacts.base.classes,
        automationMode: 'ASSISTED' as const,
        trackAmmunition: false,
        ammunition: null
      }
      const overridden = prepareNativeCharacterActionState({ ...exhausted, overridable: true })
      expect(overridden.resourceConsumption).toBeNull()
      expect(overridden.ruleWarnings).toEqual([
        { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough uses left: needs 1, has 0.' }
      ])
      expect(() => prepareNativeCharacterActionState({ ...exhausted, overridable: false })).toThrow(
        'unavailable or stale'
      )
      const unequipped = prepareNativeCharacterActionState({
        entry,
        candidate,
        policyOutput: decide({
          status: 'UNAVAILABLE',
          reasonCode: 'SOURCE_NOT_EQUIPPED',
          resourcePoolId: null,
          resourceCost: null
        }),
        resourceUsage: current.sheetState.resourceUsage,
        characterId: character.id,
        inventory: [],
        itemUsage: [],
        expectedStreamVersion: current.active.play.streamVersion,
        classLevels: current.ruleEvaluation.facts.grantFoldFacts.base.classes,
        automationMode: 'ASSISTED',
        trackAmmunition: false,
        ammunition: null,
        overridable: true
      })
      expect(unequipped.ruleWarnings).toEqual([
        { code: 'SOURCE_NOT_EQUIPPED', message: "The item this action uses isn't equipped." }
      ])
      expect(unequipped.resourceConsumption).toMatchObject({ cost: 1, afterRemaining: 1 })
      return { ...prepared.resourceConsumption, staleRawUsageRefused }
    })
    expect(result).toMatchObject({
      chargeId,
      cost: 1,
      beforeUsed: 0,
      afterUsed: 1,
      beforeRemaining: 2,
      afterRemaining: 1,
      staleRawUsageRefused: true
    })
  })

  it('persists a resource-only consumption and preserves unrelated Sheet state', async () => {
    const fixture = await setupCharacterRun()
    const unrelatedOwner = {
      kind: 'AUTHORED_GRANT' as const,
      resourceGrantId: crypto.randomUUID()
    }
    await fixture.t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, fixture.character.id)
      if (!row) throw new Error('Missing Character.')
      const sheetState = characterSheetStateSchema.parse({
        adjustments: [],
        movementDisplayPreference: { mode: 'AUTO' },
        partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY,
        spellCustomizations: [],
        resourceUsage: [
          {
            id: crypto.randomUUID(),
            characterId: fixture.character.id,
            owner: unrelatedOwner,
            used: 1,
            createdBy: fixture.owner.userId,
            updatedBy: fixture.owner.userId,
            createdAt: '2026-09-11T00:00:00.000Z',
            updatedAt: '2026-09-11T00:00:00.000Z'
          }
        ]
      })
      // Resource usage is play state: it lives in the play record, not the Sheet structure.
      const encoded = encodeCharacterRecord(row, {
        document: readCharacterRecord(row),
        sheetState,
        streamVersion: row.play.streamVersion,
        updatedAt: row.updatedAt
      })
      await ctx.db.patch(row.play._id, {
        state: encoded.play.state,
        checksum: encoded.play.checksum
      })
    })
    const input = command(fixture)
    await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...input,
        applications: [],
        characterResourceConsumption: resourceConsumption({
          characterId: fixture.character.id,
          expectedStreamVersion: fixture.characterStreamVersion,
          usageId: crypto.randomUUID()
        })
      })
    )
    const after = await read(fixture)
    if (!after.character || !after.actor) throw new Error('Missing persisted Character state.')
    const state = readCharacterSheetState(after.character)
    expect(state.resourceUsage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: unrelatedOwner, used: 1 }),
        expect.objectContaining({ used: 1 })
      ])
    )
    expect(state.resourceUsage).toHaveLength(2)
    expect(after.character.play.streamVersion).toBe(fixture.characterStreamVersion + 1)
  })

  it('commits hit point and resource state in one Character stream advance', async () => {
    const fixture = await setupCharacterRun()
    const result = await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...command(fixture),
        applications: [
          damage({
            actorId: fixture.actor.id,
            current: fixture.actor.currentHitPoints,
            temporary: fixture.actor.tempHitPoints,
            maximum: fixture.actor.maxHitPoints
          })
        ],
        characterResourceConsumption: resourceConsumption({
          characterId: fixture.character.id,
          expectedStreamVersion: fixture.characterStreamVersion,
          usageId: crypto.randomUUID()
        })
      })
    )
    const after = await read(fixture)
    if (!after.character || !after.actor) throw new Error('Missing persisted Character state.')
    expect(after.character.play.streamVersion).toBe(fixture.characterStreamVersion + 1)
    expect(result.characterStreamVersion).toBe(after.character.play.streamVersion)
    expect(readCharacterRecord(after.character).state.hitpoints.current).toBe(
      fixture.actor.currentHitPoints - 1
    )
    expect(readCharacterSheetState(after.character).resourceUsage).toEqual([
      expect.objectContaining({ used: 1 })
    ])
  })

  it('refuses stale resource usage or stream state without writes', async () => {
    const fixture = await setupCharacterRun()
    const before = await read(fixture)
    const input = command(fixture)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...input,
          applications: [],
          characterResourceConsumption: {
            ...resourceConsumption({
              characterId: fixture.character.id,
              expectedStreamVersion: fixture.characterStreamVersion,
              usageId: crypto.randomUUID()
            }),
            beforeUsed: 1,
            afterUsed: 2
          }
        })
      )
    ).rejects.toThrow(/resource usage is stale/)
    await expect(
      fixture.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...input,
          commandId: crypto.randomUUID(),
          applications: [],
          characterResourceConsumption: resourceConsumption({
            characterId: fixture.character.id,
            expectedStreamVersion: fixture.characterStreamVersion + 1,
            usageId: crypto.randomUUID()
          })
        })
      )
    ).rejects.toThrow(/resource consumption is stale/)
    expect(await read(fixture)).toEqual(before)
  })

  it('rolls resource persistence back with its enclosing Convex transaction', async () => {
    const fixture = await setupCharacterRun()
    const before = await read(fixture)
    await expect(
      fixture.owner.caller.run(async (ctx) => {
        await applyEncounterMechanicsBatch(ctx, {
          ...command(fixture),
          applications: [],
          characterResourceConsumption: resourceConsumption({
            characterId: fixture.character.id,
            expectedStreamVersion: fixture.characterStreamVersion,
            usageId: crypto.randomUUID()
          })
        })
        throw new Error('later terminal write failed')
      })
    ).rejects.toThrow('later terminal write failed')
    expect(await read(fixture)).toEqual(before)
  })
})
