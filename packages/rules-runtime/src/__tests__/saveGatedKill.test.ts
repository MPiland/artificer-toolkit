import { describe, expect, it } from 'vitest'

import { EFFECT_KIND } from '@artificer-toolkit/shared/core'
import { seaHag } from '@artificer-toolkit/source-data/srd/creatures/sea-hag.js'
import { willOWisp } from '@artificer-toolkit/source-data/srd/creatures/will-o-wisp.js'

import { DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY } from '../systems/dnd5e/effectActionContracts.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'
import {
  QUILL_VOLLEY_ID,
  creatureActor,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction,
  srdConditionId,
  type CreatureFeature
} from './encounterCreatureAction.js'

/**
 * SPELLS-33.T4i4b: "succeed on a saving throw or die" is a KILL on the action's own failed save,
 * authored from core options. The Will-o'-Wisp's Consume Life runs as printed (its 3d6 regain is a
 * GM ruling); the Sea Hag's Death Glare is a GM ruling behind its target requirements. A hit alone,
 * or a successful save, still never kills.
 */

const ACTOR_ID = testUuid(0xf5)
const TARGET_ID = testUuid(0xf6)

function feature(creature: typeof willOWisp, label: string) {
  const found = creature.features?.find((candidate) => candidate.label === label)
  if (!found) throw new Error(`${creature.label} must author ${label}.`)
  return found
}

/** A Wolf (CON 12, so +1 to its save) at `currentHitPoints`, holding `conditionIds`. */
function wolfTarget(input: { currentHitPoints: number; conditionIds?: readonly string[] }) {
  return {
    ...creatureActor({
      id: TARGET_ID,
      label: 'Target Wolf',
      features: [],
      ...(input.conditionIds ? { conditionIds: input.conditionIds } : {})
    }),
    currentHitPoints: input.currentHitPoints
  }
}

async function use(input: {
  statBlock: typeof willOWisp
  features: readonly CreatureFeature[]
  featureId: string
  target: ReturnType<typeof wolfTarget>
  saveRoll: number
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({
      id: ACTOR_ID,
      label: input.statBlock.label,
      statBlock: input.statBlock,
      features: input.features
    }),
    target: input.target,
    featureId: input.featureId,
    overridable: true,
    attackPerception: true
  })
  return settleCreatureAction({ prepared, rolls: [input.saveRoll] })
}

/** Whether the action proposed a GM ruling (a MANUAL_ADJUDICATION outcome applies nothing itself). */
function gmRulingProposed(execution: Awaited<ReturnType<typeof use>>['execution']) {
  return execution.execution.evidence.trace.some(
    ({ operation }) => operation.key === DND5E_MANUAL_ADJUDICATION_PROPOSAL_OPERATION_KEY
  )
}

const consumeLife = feature(willOWisp, 'Consume Life')
const deathGlare = feature(seaHag, 'Death Glare')

/** Consume Life with its failed-save path moved to `pathCode`, as a homebrew author could. */
function consumeLifeOn(pathCode: 'ON_SAVE_SUCCESS'): CreatureFeature {
  const authored = structuredClone(consumeLife)
  for (const effect of authored.effects ?? [])
    for (const path of 'paths' in effect ? effect.paths : []) path.pathCode = pathCode
  return authored
}

describe("Consume Life: a KILL on the action's own failed save (SPELLS-33.T4i4b)", () => {
  it('kills a dying target that fails the DC 10 Constitution save, and leaves the regain to the GM', async () => {
    // A natural 3 + 1 = 4 fails.
    const { execution } = await use({
      statBlock: willOWisp,
      features: [consumeLife],
      featureId: consumeLife.id,
      target: wolfTarget({ currentHitPoints: 0 }),
      saveRoll: 2
    })
    expect(execution.applications.map(({ kind }) => kind)).toEqual(['KILL'])
    expect(gmRulingProposed(execution)).toBe(true)
  })

  it('spares a target that succeeds on the save', async () => {
    // A natural 15 + 1 = 16 succeeds.
    const { execution } = await use({
      statBlock: willOWisp,
      features: [consumeLife],
      featureId: consumeLife.id,
      target: wolfTarget({ currentHitPoints: 0 }),
      saveRoll: 14
    })
    expect(execution.applications.map(({ kind }) => kind)).not.toContain('KILL')
  })

  it('refuses a target that is not at 0 hit points', async () => {
    await expect(
      use({
        statBlock: willOWisp,
        features: [consumeLife],
        featureId: consumeLife.id,
        target: wolfTarget({ currentHitPoints: 5 }),
        saveRoll: 2
      })
    ).rejects.toThrow(/not at 0 hit points/)
  })

  it('refuses a KILL on a successful save, which no rule admits', async () => {
    const authored = consumeLifeOn('ON_SAVE_SUCCESS')
    await expect(
      use({
        statBlock: willOWisp,
        features: [authored],
        featureId: authored.id,
        target: wolfTarget({ currentHitPoints: 0 }),
        saveRoll: 14
      })
    ).rejects.toThrow()
  })

  it('still refuses a KILL on a hit alone', async () => {
    const volley = structuredClone(quillVolley({ charges: 1, cost: 1, rangeFeet: 80 }))
    for (const effect of volley.effects ?? [])
      for (const path of 'paths' in effect ? effect.paths : [])
        if (path.selectionKind === 'FIXED')
          path.resultBlock.outcomes.push({
            id: '00000000-0000-4000-8000-00000000c0b1',
            effectKind: EFFECT_KIND.KILL
          })
    await expect(
      use({
        statBlock: willOWisp,
        features: [volley],
        featureId: QUILL_VOLLEY_ID,
        target: wolfTarget({ currentHitPoints: 5 }),
        saveRoll: 14
      })
    ).rejects.toThrow()
  })
})

describe('Death Glare: a GM ruling behind its target requirements (SPELLS-33.T4i4b)', () => {
  it('asks the GM to drop a frightened target that fails the DC 11 Wisdom save to 0 hit points', async () => {
    // A natural 3 + 1 = 4 fails.
    const { execution } = await use({
      statBlock: seaHag,
      features: [deathGlare],
      featureId: deathGlare.id,
      target: wolfTarget({ currentHitPoints: 11, conditionIds: [srdConditionId('FRIGHTENED')] }),
      saveRoll: 2
    })
    expect(execution.applications).toEqual([])
    expect(gmRulingProposed(execution)).toBe(true)
  })

  it('asks nothing of the GM when the target succeeds on the save', async () => {
    // A natural 15 + 1 = 16 succeeds.
    const { execution } = await use({
      statBlock: seaHag,
      features: [deathGlare],
      featureId: deathGlare.id,
      target: wolfTarget({ currentHitPoints: 11, conditionIds: [srdConditionId('FRIGHTENED')] }),
      saveRoll: 14
    })
    expect(gmRulingProposed(execution)).toBe(false)
  })

  it('refuses a target that is not frightened', async () => {
    await expect(
      use({
        statBlock: seaHag,
        features: [deathGlare],
        featureId: deathGlare.id,
        target: wolfTarget({ currentHitPoints: 11 }),
        saveRoll: 2
      })
    ).rejects.toThrow(/required condition/)
  })
})
