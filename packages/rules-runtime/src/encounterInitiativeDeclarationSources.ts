import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type {
  EncounterRunActorState,
  EncounterRunCharacterActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import {
  compiledProjectionChecksum,
  hydrateStoredCompilation
} from './authoredPublicationHydrate.js'
import { compileCharacterActionEntryPoints } from './encounterActionEntryPointCompiler.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscovery.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import type { CharacterRuleSpellPublication } from './character/contextPreparation.js'
import type { prepareCharacterSheetFromContext } from './character/sheetPreparation.js'
import type { InitiativeDeclarationSource } from './encounterInitiativeDeclarationCompiler.js'
import { takesInitiativeTurns } from './encounterInitiativeCursor.js'
import { assertCharacterFactsBoundToActor } from './encounterMovementTargets.js'

type DeclarationSheetFacts = Pick<
  Awaited<ReturnType<typeof prepareCharacterSheetFromContext>>,
  'prepared' | 'evaluationInput' | 'ruleEvaluation'
> & {
  active: { id: string; userId: string }
  character: { systemId: string; userId: string }
}

type InitiativeDeclarationSourceWithController = InitiativeDeclarationSource & {
  controllerUserId: string | null
}

/** Locks current declaration sources using authorized Sheet and publication reads. */
export async function prepareEncounterInitiativeDeclarationSources<
  TFacts extends DeclarationSheetFacts
>(input: {
  state: EncounterRunState
  campaignId: string
  actors: readonly EncounterRunActorState[]
  system: SystemAuthoredDto
  /** The Run's pinned Spells (D163), handed to each Creature source. */
  spells: ReadonlyMap<string, CompiledSpell>
  loadCharacter(actor: EncounterRunCharacterActorState): Promise<TFacts | null>
  readPublishedSpell(
    spellId: string,
    facts: TFacts
  ): Promise<{
    publication: CharacterRuleSpellPublication | null
    version: Pick<AuthoredVersionVector[number], 'versionId' | 'version' | 'checksum'>
  }>
}): Promise<{ sources: readonly InitiativeDeclarationSourceWithController[] }> {
  const { state, system } = input
  const actors = input.actors.filter(takesInitiativeTurns)
  const sources: InitiativeDeclarationSourceWithController[] = []
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') {
      sources.push(
        actor.kind === 'CREATURE'
          ? {
              kind: 'CREATURE',
              actor,
              controllerUserId: null,
              spells: input.spells,
              system: {
                conditionTypes: system.conditionTypes,
                abilities:
                  'abilities' in system && Array.isArray(system.abilities)
                    ? system.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
                    : []
              }
            }
          : { kind: 'CUSTOM', actor, controllerUserId: null }
      )
      continue
    }
    const facts = await input.loadCharacter(actor)
    assertCharacterFactsBoundToActor(
      facts,
      actor,
      state.gameSystemId,
      'Encounter Character source is unavailable.'
    )
    const entries = compileCharacterActionEntryPoints({
      gameSystemId: state.gameSystemId,
      candidates: facts.ruleEvaluation.facts.actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: state.gameSystemId,
        candidates: facts.ruleEvaluation.facts.actionCandidates,
        conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
        abilityDefinitions: facts.ruleEvaluation.facts.abilityDefinitions,
        entryPoints: facts.ruleEvaluation.actionEntryPoints
      })
    })
    const spellVersions = new Map<
      string,
      { versionId: string; version: number; checksum: string }
    >()
    for (const spellId of new Set(
      facts.ruleEvaluation.facts.spellCastCandidates.map((candidate) => candidate.spellId)
    )) {
      const { publication, version } = await input.readPublishedSpell(spellId, facts)
      const evaluatedSpell = facts.evaluationInput.spellsById?.get(spellId)
      // The rules evaluated the stored compilation of exactly the pinned publication.
      if (
        !publication ||
        !evaluatedSpell ||
        publication.checksum !== version.checksum ||
        compiledProjectionChecksum(
          hydrateStoredCompilation('SPELL', publication, publication.compilation)
        ) !== compiledProjectionChecksum(evaluatedSpell)
      )
        throw new Error('The declared spell source is stale.')
      spellVersions.set(spellId, {
        versionId: version.versionId,
        version: version.version,
        checksum: version.checksum
      })
    }
    sources.push({
      kind: 'CHARACTER',
      actor,
      controllerUserId: facts.active.userId,
      mechanics: {
        rulePolicyInput: facts.ruleEvaluation.facts,
        rulePolicyOutput: facts.ruleEvaluation.output,
        compiledActionEntryPoints: entries,
        initiativeActorFacts: toCharacterInitiativeActorFacts({
          snapshot: facts.ruleEvaluation.snapshot,
          registry: facts.ruleEvaluation.registry,
          rulePolicyOutput: facts.ruleEvaluation.output
        }),
        authoredVersionVector: [...spellVersions.entries()].map(([subjectId, value]) => ({
          subjectKind: 'SPELL' as const,
          subjectId,
          ...value
        }))
      }
    })
  }
  return {
    sources: sources.sort((left, right) => left.actor.id.localeCompare(right.actor.id))
  }
}
