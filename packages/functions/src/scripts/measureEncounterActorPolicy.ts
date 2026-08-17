import { performance } from 'node:perf_hooks'

import { encounterActorRuleInputSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'

import { checksumRuleDocument } from '../services/rules/ruleChecksum.js'
import { evaluateZenRuleModel } from '../services/rules/zenRuleEngine.js'
import { dnd5e2014CanonicalRulePackDocument } from '../services/rules/systems/dnd5e/2014/canonicalRulePack.js'

const warmupSamples = 5
const measuredSamples = 30

function percentile(values: readonly number[], fraction: number): number {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(Math.ceil(ordered.length * fraction) - 1, ordered.length - 1)] ?? 0
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

const facts = encounterActorRuleInputSchema.parse({
  contractVersion: 1,
  actors: Array.from({ length: 20 }, (_, actorIndex) => ({
    actorId: `00000000-0000-4000-8000-${String(actorIndex + 1).padStart(12, '0')}`,
    abilityScores: {
      STRENGTH: 18,
      DEXTERITY: 14,
      CONSTITUTION: 16,
      INTELLIGENCE: 10,
      WISDOM: 12,
      CHARISMA: 16
    },
    featureResources: Array.from({ length: 4 }, (_, featureIndex) => ({
      featureId: `actor-${actorIndex + 1}-feature-${featureIndex + 1}`,
      charge: {
        id: `actor-${actorIndex + 1}-charge-${featureIndex + 1}`,
        resetKind: 'DAILY',
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: 'NONE',
        ability: 'CHARISMA',
        min: 1,
        bonuses: [
          {
            id: `actor-${actorIndex + 1}-bonus-${featureIndex + 1}`,
            bonusKind: 'ABILITY_MODIFIER',
            ability: 'WISDOM',
            order: 0
          }
        ]
      },
      used: featureIndex
    }))
  }))
})
const document = rulePackDocumentDtoSchema.parse(dnd5e2014CanonicalRulePackDocument)
const cacheKey = checksumRuleDocument(document)

const coldStartedAt = performance.now()
await evaluateZenRuleModel({
  cacheKey,
  document,
  modelKey: 'encounter-actor-policy',
  context: facts
})
const coldStartMs = performance.now() - coldStartedAt

for (let index = 0; index < warmupSamples; index += 1) {
  await evaluateZenRuleModel({
    cacheKey,
    document,
    modelKey: 'encounter-actor-policy',
    context: facts
  })
}

const samples: number[] = []
let result: unknown = null
for (let index = 0; index < measuredSamples; index += 1) {
  const startedAt = performance.now()
  result = (
    await evaluateZenRuleModel({
      cacheKey,
      document,
      modelKey: 'encounter-actor-policy',
      context: facts
    })
  ).result
  samples.push(performance.now() - startedAt)
}

console.info(
  JSON.stringify({
    actorCount: facts.actors.length,
    featureResourceCount: facts.actors.reduce(
      (sum, actor) => sum + actor.featureResources.length,
      0
    ),
    warmupSamples,
    measuredSamples,
    coldStartMs: Number(coldStartMs.toFixed(2)),
    latencyMs: {
      p50: Number(percentile(samples, 0.5).toFixed(2)),
      p95: Number(percentile(samples, 0.95).toFixed(2)),
      maximum: Number(Math.max(...samples).toFixed(2))
    },
    bytes: {
      document: jsonBytes(document),
      facts: jsonBytes(facts),
      result: jsonBytes(result)
    }
  })
)
