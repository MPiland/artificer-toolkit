import { describe, expect, it } from 'vitest'

import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { arcaneHand } from '@artificer-toolkit/source-data/srd/spells/arcane-hand.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

import {
  normalizeIngressValues,
  normalizeNodeRuntimeValues,
  resolveNodeRuntime
} from './nodeRuntimeService.js'
import { createNodeRuntimeSourceReader } from './systemSourceRows.js'

// A second System scored on two abilities of its own.
const otherSystem = {
  ...srdSystemRecord,
  id: '00000000-0000-4000-8000-0000000000aa',
  abilities: [
    { id: '00000000-0000-4000-8000-0000000000ab', code: 'MIGHT', label: 'Might', short: 'MGT' },
    { id: '00000000-0000-4000-8000-0000000000ac', code: 'WIT', label: 'Wit', short: 'WIT' }
  ]
}

function readerFor(system: typeof srdSystemRecord) {
  return createNodeRuntimeSourceReader({
    coreCodes: dnd5eCoreCodeAdapter.lists,
    system,
    readAuthoredRows: () => [],
    readReusableDefinitions: async () => []
  })
}

async function nodesOf(system: typeof srdSystemRecord, mapId: string) {
  const result = await resolveNodeRuntime(readerFor(system), {
    mapId,
    systemId: system.id,
    values: {}
  })
  return result.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
}

describe('node maps keyed by a System table', () => {
  it('gives a Creature one score per ability of the request’s System, in System order', async () => {
    for (const system of [srdSystemRecord, otherSystem]) {
      const nodes = await nodesOf(system, 'abilityScores')
      expect(nodes.map(({ id, path, label, kind }) => ({ id, path, label, kind }))).toEqual(
        system.abilities.map(({ code, label }) => ({
          id: code,
          path: [code],
          label,
          kind: 'INPUT'
        }))
      )
    }
  })

  it('gives a summoned stat block one numeric expression per ability of the System', async () => {
    const nodes = await nodesOf(otherSystem, 'summonAbilityScores')
    expect(nodes.map((node) => node.kind === 'GROUP' && [node.id, node.childMapId])).toEqual([
      ['MIGHT', 'numericExpr'],
      ['WIT', 'numericExpr']
    ])
  })

  it('resolves an empty summon ability score object, so the author can fill it', async () => {
    const result = await resolveNodeRuntime(readerFor(otherSystem), {
      mapId: 'summonStatBlock',
      systemId: otherSystem.id,
      values: { abilityScores: {} }
    })
    const scope = result.scopes.find(({ path }) => path.join('.') === 'abilityScores')
    expect(scope?.mapId).toBe('summonAbilityScores')
    expect(
      scope?.steps.flatMap((step) =>
        step.sections.flatMap(({ nodes }) => nodes.map(({ id }) => id))
      )
    ).toEqual(['MIGHT', 'WIT'])
  })

  it('clears a key the System does not list in the editor and refuses it at ingress', async () => {
    const request = {
      mapId: 'abilityScores',
      systemId: otherSystem.id,
      values: { MIGHT: 12, STRENGTH: 14 }
    }
    const normalized = await normalizeNodeRuntimeValues(readerFor(otherSystem), request)
    expect(normalized.values).toEqual({ MIGHT: 12 })
    expect(normalized.refusedPaths).toEqual([['STRENGTH']])
    await expect(normalizeIngressValues(readerFor(otherSystem), request)).rejects.toThrow(
      'The Game System does not define 14 at STRENGTH.'
    )
  })
})

describe('keyed ability scores through the authoring form (D193 parity)', () => {
  it('keeps the SRD Brown Bear’s ability scores exactly as authored', async () => {
    const result = await normalizeIngressValues(readerFor(srdSystemRecord), {
      mapId: 'creature',
      systemId: srdSystemRecord.id,
      values: structuredClone(brownBear) as unknown as Record<string, unknown>
    })
    expect(result.clearedPaths).toEqual([])
    expect(result.values.abilityScores).toEqual(brownBear.abilityScores)
  })

  it('keeps the SRD Arcane Hand’s summoned ability scores exactly as authored', async () => {
    const result = await normalizeIngressValues(readerFor(srdSystemRecord), {
      mapId: 'spell',
      systemId: srdSystemRecord.id,
      values: structuredClone(arcaneHand) as unknown as Record<string, unknown>
    })
    // The reader authors no classes, so only the effects subtree is compared.
    expect(result.clearedPaths.filter(([root]) => root === 'effects')).toEqual([])
    expect(result.values.effects).toEqual(arcaneHand.effects)
  })
})
