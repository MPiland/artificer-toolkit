import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { compileCharacterActionEntryPoints } from './encounterActionEntryPointCompiler.js'
import { discoverCharacterActionCapabilities } from './characterActionCapabilityDiscoveryRegistry.js'
import { toCharacterInitiativeActorFacts } from './character/characterInitiativeFacts.js'
import type { prepareCharacterSheetFromContext } from './character/sheetPreparation.js'
import type { InitiativeDeclarationSource } from './encounterInitiativeDeclarationCompiler.js'

type DeclarationSheetFacts = Pick<
  Awaited<ReturnType<typeof prepareCharacterSheetFromContext>>,
  'prepared' | 'evaluationInput' | 'ruleEvaluation'
> & {
  active: { streamVersion: number; userId: string }
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
  loadCharacter(actor: EncounterRunActorState): Promise<TFacts | null>
  readPublishedSpell(
    spellId: string,
    facts: TFacts
  ): Promise<{
    publication: AuthoredPublicationDocument | null
    version: Pick<AuthoredVersionVector[number], 'versionId' | 'version' | 'checksum'>
  }>
}): Promise<{ sources: readonly InitiativeDeclarationSourceWithController[] }> {
  const { state, actors, system } = input
  const sources: InitiativeDeclarationSourceWithController[] = []
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') {
      sources.push({
        kind: actor.kind,
        actor,
        controllerUserId: null,
        ...(actor.kind === 'CREATURE'
          ? {
              system: {
                conditionTypes: system.conditionTypes,
                abilities:
                  'abilities' in system && Array.isArray(system.abilities)
                    ? system.abilities.map((ability) => ({ id: ability.id, code: ability.code }))
                    : []
              }
            }
          : {})
      })
      continue
    }
    if (!actor.sourceId || actor.sourceRevision === null)
      throw new Error('Character initiative source is incomplete.')
    const facts = await input.loadCharacter(actor)
    if (
      !facts ||
      facts.active.streamVersion !== actor.sourceRevision ||
      facts.character.systemId !== state.gameSystemId
    )
      throw new Error('Encounter Character source is stale.')
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
      const evaluatedSpell = facts.evaluationInput.spellDocumentsById?.get(spellId)
      if (
        !publication ||
        !evaluatedSpell ||
        checksumRuleDocument(evaluatedSpell) !== version.checksum ||
        checksumRuleDocument(publication.document) !== version.checksum
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
