import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { makeFunctionReference } from 'convex/server'
import type { ConvexHttpClient } from 'convex/browser'
import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterPlayerProjectionDtoSchema,
  resolveEncounterActionInputDtoSchema,
  type EncounterCommandResultDto,
  type EncounterTimelineDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoiceDto,
  EncounterActionChoicesResponseDto,
  EncounterOptionalActionChoicesDto,
  GetEncounterActionChoicesInputDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ATHLETICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { api } from '../convex/_generated/api.js'
import {
  assertDomainRejection,
  type DevelopmentClient,
  executeEncounterCommand
} from './developmentClient'
import { createDisarmCreature, createDisarmWeapon } from './fixtures/disarmCreature'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
const optionalChoices = makeFunctionReference<
  'query',
  GetEncounterOptionalActionChoicesInputDto,
  EncounterOptionalActionChoicesDto
>('encounters/actionChoices:optional')

export type EncounterDisarmBrowserFixture = {
  scene: { id: string; name: string }
  action: EncounterActionChoiceDto
  targetLabel: string
  optionalChoices: EncounterOptionalActionChoicesDto
  command: ResolveEncounterActionInputDto
}

export type EncounterDisarmBrowserControls = {
  resolveAction: () => Promise<{
    command: ResolveEncounterActionInputDto
    result: EncounterCommandResultDto
  }>
  resolveEvidence: (
    actor: 'OWNER' | 'PLAYER',
    expected: ResolveRuleOccurrenceInputDto
  ) => Promise<{ command: ResolveRuleOccurrenceInputDto; result: EncounterCommandResultDto }>
  assertInitiatorPrivacy: () => Promise<void>
  assertDefenderPending: () => Promise<void>
  reload: () => Promise<void>
}

export type EncounterDisarmBrowserRunner = (
  fixture: EncounterDisarmBrowserFixture,
  verify: (controls: EncounterDisarmBrowserControls) => Promise<void>
) => Promise<void>

export async function verifyEncounterDisarm({
  owner,
  player,
  ownerUserId,
  playerUserId,
  campaignId,
  characterId,
  otherEquipmentId,
  initiativePolicyDefinitionId,
  initiativePolicyCatalogueId,
  checkpoint,
  readTimeline,
  browser
}: {
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  player: DevelopmentClient & Pick<ConvexHttpClient, 'action'>
  ownerUserId: string
  playerUserId: string
  campaignId: string
  characterId: string
  otherEquipmentId: string
  initiativePolicyDefinitionId: string
  initiativePolicyCatalogueId: string
  /** Publishes what the room holds to Convex: a running table saves only at save points (D90). */
  checkpoint: () => Promise<void>
  /** The GM's Run timeline as the room pushes it; the room carries Encounter history for the Run (D88). */
  readTimeline: () => Promise<EncounterTimelineDto | null>
  browser?: EncounterDisarmBrowserRunner
}) {
  const weapon = createDisarmWeapon(crypto.randomUUID())
  const creature = createDisarmCreature(weapon, crypto.randomUUID())
  for (const [subjectKind, payload] of [
    ['EQUIPMENT', weapon],
    ['CREATURE', creature]
  ] as const) {
    const draft = await owner.mutation(api.content.drafts.save, {
      subjectKind,
      subjectId: payload.id,
      systemId: srdSystemRecord.id,
      label: payload.label,
      payload
    })
    assert.ok(draft.updatedAt)
    await owner.mutation(api.content.publication.publishDraft, {
      subjectKind,
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
  }
  const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
  await owner.mutation(api.campaigns.update.update, {
    campaignId,
    expectedVersion: campaign.version,
    additionalRulesCatalogueIds: [
      ...campaign.additionalRulesCatalogueIds,
      initiativePolicyCatalogueId
    ]
  })
  const disarm = SRD_OPTIONAL_COMBAT_DEFINITIONS.find((entry) => entry.document.kind === 'DISARM')
  assert.ok(disarm)
  // The GM initiates the Disarm; each participant's d20 follows that actor's controller's auto-roll
  // preference, so with it off for both, Assisted prompts both for d20s.
  await owner.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  await player.mutation(api.account.setAutoRollDice, { autoRollDice: false })
  const settings = await owner.query(api.campaigns.playSettings.get, { campaignId })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId,
    initiativeTieDefinitionId: null,
    optionalCombatRuleDefinitionIds: [disarm.id]
  })
  const initialSheet = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(initialSheet)
  const held = initialSheet.inventory.items.find((entry) => entry.equipmentId === club.id)
  assert.ok(held)
  const added = await player.mutation(api.characters.sheetCommands.execute, {
    id: characterId,
    command: {
      type: 'ADD_INVENTORY_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: initialSheet.meta.streamVersion,
      equipmentId: otherEquipmentId,
      quantity: 1
    }
  })
  await player.mutation(api.characters.sheetCommands.execute, {
    id: characterId,
    command: {
      type: 'EQUIP_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: added.streamVersion,
      itemId: held.id
    }
  })
  await player.mutation(api.campaigns.assignments.assign, { campaignId, characterId })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Assisted Disarm functional fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const created = await owner.mutation(api.encounters.runs.create, {
    campaignId,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  let started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: created.id,
      commandId: crypto.randomUUID(),
      expectedVersion: created.version
    }
  })
  for (let responses = 0; started.occurrence?.status === 'PENDING'; responses++) {
    assert.ok(responses < 20, 'Disarm fixture initiative did not settle.')
    const pending = started.occurrence.pending
    assert.ok(pending)
    let resolution: ResolveRuleOccurrenceInputDto['resolution']
    if (pending.kind === 'INITIATIVE_EVIDENCE') {
      resolution = {
        kind: 'ENTER_INTEGER',
        requestId: pending.request.requestId,
        value: pending.request.max
      }
    } else {
      assert.equal(pending.kind, 'INITIATIVE_ORDER')
      if (pending.kind !== 'INITIATIVE_ORDER') throw new Error('Unexpected initiative request.')
      const entityId = pending.optionIds[0]
      assert.ok(entityId)
      resolution = { kind: 'INITIATIVE_ENTITY', requestId: pending.requestId, entityId }
    }
    started = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: created.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version,
        correlationId: null,
        occurrenceId: started.occurrence.occurrenceId,
        expectedOccurrenceVersion: started.occurrence.occurrenceVersion,
        resolution
      }
    })
  }
  let run = encounterGmProjectionDtoSchema.parse(started.projection)
  const source = run.actors.find(
    (actor) => actor.kind === 'CREATURE' && actor.sourceId === creature.id
  )
  const target = run.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
  )
  assert.ok(source && target)
  assert.equal(run.actors.length, 2)
  let scene: EncounterDisarmBrowserFixture['scene'] | undefined
  let sceneContext: ResolveEncounterActionInputDto['sceneContext'] = null
  if (browser) {
    const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
    const { bindScene, bindToken } = await import('./developmentEncounterLifecycle')
    const sourceTokenId = crypto.randomUUID()
    const targetTokenId = crypto.randomUUID()
    const name = 'Assisted Disarm browser scene'
    const preparedScene = await createEncounterLifecycleScene({
      owner,
      campaignId,
      name,
      options: {
        map: { width: 400, height: 200 },
        grid: {
          kind: 'SQUARE',
          origin: { x: 0, y: 0 },
          cellSize: 100,
          distancePerCell: 5,
          diagonalPolicy: 'EQUAL',
          unit: 'FEET'
        },
        tokens: [
          {
            id: sourceTokenId,
            assetId: null,
            controlledByUserIds: [],
            height: 100,
            hidden: false,
            label: 'Disarm attacker',
            locked: false,
            position: { x: 50, y: 50 },
            rotationDegrees: 0,
            vision: null,
            width: 100
          },
          {
            id: targetTokenId,
            assetId: null,
            controlledByUserIds: [playerUserId],
            height: 100,
            hidden: false,
            label: 'Disarm defender',
            locked: false,
            position: { x: 150, y: 50 },
            rotationDegrees: 0,
            width: 100,
            vision: {
              enabled: true,
              brightRange: 10,
              dimRange: 0,
              angleDegrees: 360,
              directionDegrees: 0
            }
          }
        ]
      }
    })
    const presentation = await owner.query(api.scenes.presentations.get, { campaignId })
    await owner.action(api.scenes.presentations.setLive, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      campaignId,
      sceneId: preparedScene.liveSceneId,
      expectedPresentationVersion: presentation?.version ?? null
    })
    await owner.mutation(bindScene, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      encounterId: run.id,
      commandId: crypto.randomUUID()
    })
    run = encounterGmProjectionDtoSchema.parse(
      await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
    )
    for (const [actorId, tokenId] of [
      [source.id, sourceTokenId],
      [target.id, targetTokenId]
    ] as const) {
      run = encounterGmProjectionDtoSchema.parse(
        (
          await owner.mutation(bindToken, {
            input: {
              type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
              commandId: crypto.randomUUID(),
              encounterId: run.id,
              expectedEncounterVersion: run.version,
              actorId,
              sceneId: preparedScene.liveSceneId,
              tokenId
            }
          })
        ).projection
      )
    }
    const header = await owner.query(api.scenes.recipientReads.header, {
      sceneId: preparedScene.liveSceneId
    })
    sceneContext = {
      sceneId: preparedScene.liveSceneId,
      expectedSceneVersion: header.version,
      sourceTokenId,
      targetTokenId
    }
    scene = { id: preparedScene.liveSceneId, name }
  }
  if (run.currentActorId !== source.id) {
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(executeEncounterCommand, {
          command: {
            type: 'SET_CURRENT_ACTOR',
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version,
            actorId: source.id
          }
        })
      ).projection
    )
  }
  const beforeSource = run.actors.find((actor) => actor.id === source.id)
  assert.ok(beforeSource)
  assert.equal(encounterRuleUsageUsed(beforeSource, SRD_ACTION_ALLOWANCE_DEFINITION_ID), 0)
  const choices = await owner.query(actionChoices, {
    encounterId: run.id,
    expectedVersion: run.version,
    actorId: source.id
  })
  assert.ok(choices, 'Current action choices must be available.')
  assert.equal(choices.actions.length, 1)
  const action = choices.actions[0]
  const definition = choices.optionalRules.find((entry) => entry.definitionId === disarm.id)
  assert.ok(action && definition)
  const descriptor = await owner.query(optionalChoices, {
    encounterId: run.id,
    expectedVersion: run.version,
    actorId: source.id,
    targetActorId: target.id,
    actionId: action.id,
    definitionId: definition.definitionId,
    sceneContext
  })
  // The GM's drawer submits the account's stored roll visibility with every action.
  const { gmRollVisibility } = await owner.query(api.account.rollPreferences, {})
  let command: ResolveEncounterActionInputDto = resolveEncounterActionInputDtoSchema.parse({
    type: 'RESOLVE_ACTION',
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: run.version,
    actorId: source.id,
    target: { kind: 'ACTOR', actorId: target.id },
    actionId: action.id,
    sceneContext,
    visibility: gmRollVisibility,
    optionalCombatIntent: {
      definitionId: descriptor.definitionId,
      optionId: descriptor.optionId,
      selectionContract: descriptor.selectionContract,
      selections: descriptor.fields.map((field) => {
        const selected = field.options.find(
          (option) => option.id === held.id || option.id === SRD_ATHLETICS_SKILL_ID
        )
        assert.ok(selected, 'Issued Disarm choices must offer the held item and Athletics.')
        return { fieldId: field.fieldId, value: { kind: 'ENTITY', entityId: selected.id } }
      })
    }
  })
  assert.ok(
    command.optionalCombatIntent?.selections.some(
      (selection) => selection.value.kind === 'ENTITY' && selection.value.entityId === held.id
    )
  )

  async function snapshot() {
    await checkpoint()
    const [ownerRun, playerRun, sheet, character] = await Promise.all([
      owner.query(api.encounters.projectionReads.get, { encounterId: run.id }),
      player.query(api.encounters.projectionReads.get, { encounterId: run.id }),
      player.query(api.characters.sheet.get, { id: characterId }),
      player.query(api.characters.builder.activeCharacter, { id: characterId })
    ])
    assert.ok(sheet && character)
    const projection = encounterPlayerProjectionDtoSchema.parse(playerRun)
    assert.deepEqual(projection, playerRun)
    for (const actor of projection.actors) {
      for (const field of ['gmNotes', 'statBlock', 'resources', 'currentHitPoints', 'features'])
        assert.equal(field in actor, false)
      assert.equal(actor.sourceRevision, null)
      if (actor.kind === 'CREATURE') assert.equal(actor.sourceId, null)
    }
    assert.equal(character.userId, playerUserId)
    assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
    return {
      run: encounterGmProjectionDtoSchema.parse(ownerRun),
      playerRun,
      sheet,
      character
    }
  }
  const before = await snapshot()
  assert.deepEqual(before.run, run)
  assert.equal(before.sheet.inventory.items.find((item) => item.id === held.id)?.equipped, true)
  assert.ok(
    before.sheet.inventory.items.some(
      (item) => item.equipmentId === otherEquipmentId && item.id !== held.id
    )
  )
  assert.deepEqual(before.character.state.equipment.equipped, [held.id])
  assert.equal(await owner.query(api.characters.builder.activeCharacter, { id: characterId }), null)
  function evidence(result: unknown, face: number): ResolveRuleOccurrenceInputDto {
    const occurrence = encounterCommandResultDtoSchema.parse(result).occurrence
    const pending = occurrence?.pending
    if (occurrence?.status !== 'PENDING' || pending?.kind !== 'D20_EVIDENCE')
      throw new Error(
        `Expected Assisted Disarm d20 evidence, received ${occurrence?.status ?? 'no occurrence'} with ${pending?.kind ?? 'no pending decision'}.`
      )
    return {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      correlationId: null,
      occurrenceId: occurrence.occurrenceId,
      expectedOccurrenceVersion: occurrence.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
  const verify = async (controls?: EncounterDisarmBrowserControls) => {
    const browserRoot = await controls?.resolveAction()
    if (browserRoot) {
      assert.deepEqual({ ...browserRoot.command, commandId: command.commandId }, command)
      command = browserRoot.command
    }
    const initiated =
      browserRoot?.result ?? (await owner.mutation(executeEncounterCommand, { command }))
    let first = evidence(initiated, 20)
    await controls?.assertInitiatorPrivacy()
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(
      await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, { encounterId: run.id }),
      initiated.occurrence?.pending
    )
    assert.equal(
      await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      }),
      null
    )
    assert.deepEqual(await owner.mutation(executeEncounterCommand, { command }), initiated)
    await assert.rejects(
      player.mutation(executeEncounterCommand, { command: first }),
      /NOT_ACTOR_CONTROLLER/
    )
    await assert.rejects(
      owner.mutation(executeEncounterCommand, {
        command: {
          ...first,
          commandId: crypto.randomUUID(),
          resolution: {
            kind: 'SYSTEM_ROLL',
            requestId: 'stale-request',
            rollId: crypto.randomUUID()
          }
        }
      }),
      /stale/
    )
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(
      await owner.query(api.encounters.pendingReads.pendingRuleOccurrence, { encounterId: run.id }),
      initiated.occurrence?.pending
    )
    const browserFirst = await controls?.resolveEvidence('OWNER', first)
    if (browserFirst) {
      assert.deepEqual({ ...browserFirst.command, commandId: first.commandId }, first)
      first = browserFirst.command
    }
    const answered =
      browserFirst?.result ?? (await owner.mutation(executeEncounterCommand, { command: first }))
    let second = evidence(answered, 1)
    await controls?.assertDefenderPending()
    assert.equal(answered.occurrence?.occurrenceId, initiated.occurrence?.occurrenceId)
    assert.notDeepEqual(second.resolution, first.resolution)
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(
      await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      }),
      answered.occurrence?.pending
    )
    await assert.rejects(
      owner.mutation(executeEncounterCommand, {
        command: { ...first, commandId: crypto.randomUUID() }
      }),
      /stale/
    )
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual(
      await player.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: run.id
      }),
      answered.occurrence?.pending
    )
    const browserSecond = await controls?.resolveEvidence('PLAYER', second)
    if (browserSecond) {
      assert.deepEqual({ ...browserSecond.command, commandId: second.commandId }, second)
      second = browserSecond.command
    }
    let completed: EncounterCommandResultDto
    let staleSecond: ResolveRuleOccurrenceInputDto | undefined
    if (browserSecond) completed = browserSecond.result
    else {
      const contenders = [second, { ...second, commandId: crypto.randomUUID() }] as const
      const raced = await Promise.allSettled([
        player.mutation(executeEncounterCommand, { command: contenders[0] }),
        player.mutation(executeEncounterCommand, { command: contenders[1] })
      ])
      assert.equal(raced.filter((result) => result.status === 'fulfilled').length, 1)
      const winnerIndex = raced.findIndex((result) => result.status === 'fulfilled')
      const winner = raced[winnerIndex]
      const loser = raced[1 - winnerIndex]
      if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
        throw new Error('Disarm contention did not produce one winner and one stale loser.')
      assertDomainRejection(loser.reason, 'VERSION_STALE')
      second = contenders[winnerIndex]!
      staleSecond = contenders[1 - winnerIndex]!
      completed = encounterCommandResultDtoSchema.parse(winner.value)
    }
    assert.equal(completed.occurrence?.status, 'COMPLETE')
    assert.equal(completed.occurrence?.pending, null)
    const after = await snapshot()
    assert.deepEqual(completed.projection, after.playerRun)
    assert.equal(after.run.version, run.version + 1)
    assert.equal(after.sheet.meta.streamVersion, before.sheet.meta.streamVersion + 1)
    assert.deepEqual(after.character, {
      ...before.character,
      state: {
        ...before.character.state,
        equipment: { ...before.character.state.equipment, equipped: [] }
      }
    })
    assert.deepEqual(after.sheet.inventory, {
      ...before.sheet.inventory,
      items: before.sheet.inventory.items.map((item) =>
        item.id === held.id ? { ...item, equipped: false } : item
      )
    })
    const finalSource = after.run.actors.find((actor) => actor.id === source.id)
    const finalTarget = after.run.actors.find((actor) => actor.id === target.id)
    assert.ok(finalSource && finalTarget)
    assert.equal(encounterRuleUsageUsed(finalSource, SRD_ACTION_ALLOWANCE_DEFINITION_ID), 1)
    assert.equal(finalTarget.sourceId, characterId)
    assert.equal(finalTarget.sourceRevision, null)
    assert.equal(
      await owner.query(api.characters.builder.activeCharacter, { id: characterId }),
      null
    )
    for (const client of [owner, player])
      assert.equal(
        await client.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: run.id
        }),
        null
      )

    if (staleSecond) {
      // A persisted response receipt would replay before the stale-version check.
      await assert.rejects(
        player.mutation(executeEncounterCommand, { command: staleSecond }),
        (error) => assertDomainRejection(error, 'VERSION_STALE')
      )
      assert.deepEqual(await snapshot(), after)
    }

    // The room holds the Run's rule receipts and no client reads them (D88). The GM's timeline is the
    // room's client-visible record: one root action issued by the GM, no newer than the completed
    // Run. The Disarm outputs show in the Run, Sheet and Character asserted above.
    const timelineEntries = async () => {
      const timeline = await readTimeline()
      assert.ok(timeline, 'The room must push the held Run timeline.')
      return timeline.entries
    }
    const recorded = await timelineEntries()
    const resolvedActions = recorded.filter((entry) => entry.commandType === 'RESOLVE_ACTION')
    assert.equal(resolvedActions.length, 1)
    const [resolvedAction] = resolvedActions
    assert.equal(resolvedAction?.actorUserId, ownerUserId)
    assert.ok(resolvedAction && resolvedAction.version <= after.run.version)

    // An exact replay returns the command's own stored receipt over the Run's current projection.
    const rootReplay = await owner.mutation(executeEncounterCommand, { command })
    assert.deepEqual(rootReplay, { ...initiated, projection: after.run })
    assert.deepEqual(await owner.mutation(executeEncounterCommand, { command }), rootReplay)
    assert.deepEqual(await owner.mutation(executeEncounterCommand, { command: first }), {
      ...answered,
      projection: after.run
    })
    assert.deepEqual(
      browserSecond
        ? await player.mutation(executeEncounterCommand, { command: second })
        : await player.mutation(executeEncounterCommand, { command: second }),
      completed
    )
    assert.deepEqual(await snapshot(), after)
    assert.deepEqual(await timelineEntries(), recorded, 'Exact replays must not add history.')
    await controls?.reload()
    assert.deepEqual(await snapshot(), after)
    const evidenceDirectory = new URL(
      '../../../local-validation/local-convex-proofs/disarm-live-driver-20260915/',
      import.meta.url
    )
    await mkdir(evidenceDirectory, { recursive: true })
    await writeFile(
      new URL('timeline-' + run.id + '.json', evidenceDirectory),
      JSON.stringify(
        {
          proof: 'Assisted Creature Disarm versus assigned PLAYER Character',
          timelineEntry: resolvedAction,
          publicAgreement: {
            encounterId: run.id,
            rootCommandId: command.commandId,
            characterId,
            selectedItemId: held.id,
            beforeRunVersion: run.version,
            afterRunVersion: after.run.version,
            beforeCharacterVersion: before.sheet.meta.streamVersion,
            afterCharacterVersion: after.sheet.meta.streamVersion,
            ownershipPreserved: true,
            unrelatedInventoryPreserved: true,
            actionSpent: 1,
            exactReplay: true,
            projectionPrivacy: true,
            ...(staleSecond
              ? {
                  terminalContention: {
                    winnerCommandId: second.commandId,
                    staleCommandId: staleSecond.commandId,
                    winnerReplayMatched: true,
                    staleRetryRejected: true
                  }
                }
              : {})
          }
        },
        null,
        2
      ) + '\n'
    )
    console.log(
      'Assisted Disarm public discovery, participant evidence, item state, history, replay and privacy passed.'
    )
  }
  if (browser) {
    assert.ok(scene)
    await browser(
      {
        scene,
        action,
        targetLabel: target.label,
        optionalChoices: descriptor,
        command
      },
      verify
    )
  } else await verify()
}
