import { describe, expect, it } from 'vitest'

import { EFFECT_KIND, MANIFEST_KIND, TRIGGER } from '#core'
import {
  EFFECT_NODE_MAP,
  MANIFEST_NESTED_EFFECT_NODE_MAP,
  PATH_NODE_MAP,
  SPELL_NODE_MAP
} from '#maps'
import { evaluateConditionIf } from '#utils'

describe('effect node maps', () => {
  it('offers incoming saving throws as an authored trigger', () => {
    const triggerNode = EFFECT_NODE_MAP.nodes.invocation

    if (triggerNode.kind !== 'GROUP') {
      throw new Error('Expected invocation to be a group node')
    }

    const invocationMap =
      typeof triggerNode.nodes === 'function' ? triggerNode.nodes() : triggerNode.nodes
    const triggerCodeNode = invocationMap.nodes.triggerCode

    if (
      triggerCodeNode.kind !== 'INPUT' ||
      triggerCodeNode.type !== 'SELECT_SINGLE' ||
      triggerCodeNode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected trigger code to be an inline select')
    }

    expect(triggerCodeNode.source.options.map((option) => option.code)).toContain(
      TRIGGER.INCOMING_SAVING_THROW
    )
  })

  it('offers the hit-point-zero trigger with the saving throw an area of its own needs', () => {
    const invocationNode = EFFECT_NODE_MAP.nodes.invocation

    if (invocationNode.kind !== 'GROUP') {
      throw new Error('Expected invocation to be a group node')
    }

    const invocationMap =
      typeof invocationNode.nodes === 'function' ? invocationNode.nodes() : invocationNode.nodes
    const { triggerCode, savingThrow } = invocationMap.nodes

    if (
      triggerCode?.kind !== 'INPUT' ||
      triggerCode.type !== 'SELECT_SINGLE' ||
      triggerCode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected trigger code to be an inline select')
    }
    if (savingThrow?.kind !== 'GROUP' || !savingThrow.showIf) {
      throw new Error('Expected the saving throw group to be conditional')
    }

    expect(triggerCode.source.options.map((option) => option.code)).toContain(TRIGGER.HP_ZERO)
    expect(
      evaluateConditionIf(savingThrow.showIf, { values: { triggerCode: TRIGGER.HP_ZERO } })
    ).toBe(true)
    expect(
      evaluateConditionIf(savingThrow.showIf, { values: { triggerCode: TRIGGER.ENTER_AREA } })
    ).toBe(false)
  })

  it('offers a resource restore outcome only for the restore kind, with its three fields', () => {
    const resultNode = PATH_NODE_MAP.nodes.resultBlock
    if (resultNode?.kind !== 'GROUP')
      throw new Error('Expected the result block to be a group node')
    const resultMap = typeof resultNode.nodes === 'function' ? resultNode.nodes() : resultNode.nodes
    const outcomesNode = resultMap.nodes.outcomes
    if (outcomesNode?.kind !== 'GROUP') throw new Error('Expected outcomes to be a group node')
    const outcomeMap =
      typeof outcomesNode.nodes === 'function' ? outcomesNode.nodes() : outcomesNode.nodes
    const fields = ['chargeId', 'restoreFloor', 'restoreWhenAtOrBelow'].map((key) => {
      const node = outcomeMap.nodes[key]
      if (!node?.showIf) throw new Error(`Expected ${key} to be conditional`)
      return node.showIf
    })

    for (const showIf of fields) {
      expect(
        evaluateConditionIf(showIf, { values: { effectKind: EFFECT_KIND.RESTORE_RESOURCE } })
      ).toBe(true)
      expect(
        evaluateConditionIf(showIf, { values: { effectKind: EFFECT_KIND.ARMOR_CLASS_FLOOR } })
      ).toBe(false)
    }
  })

  it('offers a spell slot exchange outcome with the fields of the chosen mode only', () => {
    const resultNode = PATH_NODE_MAP.nodes.resultBlock
    if (resultNode?.kind !== 'GROUP')
      throw new Error('Expected the result block to be a group node')
    const resultMap = typeof resultNode.nodes === 'function' ? resultNode.nodes() : resultNode.nodes
    const outcomesNode = resultMap.nodes.outcomes
    if (outcomesNode?.kind !== 'GROUP') throw new Error('Expected outcomes to be a group node')
    const outcomeMap =
      typeof outcomesNode.nodes === 'function' ? outcomesNode.nodes() : outcomesNode.nodes
    const shown = (key: string, mode: string) => {
      const showIf = outcomeMap.nodes[key]?.showIf
      if (!showIf) throw new Error(`Expected ${key} to be conditional`)
      return evaluateConditionIf(showIf, {
        values: { effectKind: EFFECT_KIND.SPELL_SLOT_EXCHANGE, mode }
      })
    }
    const fieldsByMode = (mode: string) =>
      [
        'spellSlotExchangeMode',
        'spellSlotLevelBudget',
        'spellSlotMaximumLevel',
        'chargeId',
        'spellSlotCosts'
      ].filter((key) => shown(key, mode))

    expect(fieldsByMode('RECOVER_SLOTS')).toEqual([
      'spellSlotExchangeMode',
      'spellSlotLevelBudget',
      'spellSlotMaximumLevel'
    ])
    expect(fieldsByMode('SLOT_TO_RESOURCE')).toEqual([
      'spellSlotExchangeMode',
      'spellSlotMaximumLevel',
      'chargeId'
    ])
    expect(fieldsByMode('RESOURCE_TO_SLOT')).toEqual([
      'spellSlotExchangeMode',
      'chargeId',
      'spellSlotCosts'
    ])
    const modeShowIf = outcomeMap.nodes.spellSlotExchangeMode?.showIf
    if (!modeShowIf) throw new Error('Expected the exchange mode to be conditional')
    expect(
      evaluateConditionIf(modeShowIf, { values: { effectKind: EFFECT_KIND.RESTORE_RESOURCE } })
    ).toBe(false)
  })

  it('offers an end-effects outcome only for the end-effects kind, with its scope and conditions', () => {
    const resultNode = PATH_NODE_MAP.nodes.resultBlock
    if (resultNode?.kind !== 'GROUP')
      throw new Error('Expected the result block to be a group node')
    const resultMap = typeof resultNode.nodes === 'function' ? resultNode.nodes() : resultNode.nodes
    const outcomesNode = resultMap.nodes.outcomes
    if (outcomesNode?.kind !== 'GROUP') throw new Error('Expected outcomes to be a group node')
    const outcomeMap =
      typeof outcomesNode.nodes === 'function' ? outcomesNode.nodes() : outcomesNode.nodes
    const scope = outcomeMap.nodes.endEffectsScope
    const selectors = outcomeMap.nodes.endEffectsSelectors
    if (!scope?.showIf || !selectors?.showIf)
      throw new Error('Expected both end-effects fields to be conditional')

    for (const { showIf } of [scope, selectors]) {
      expect(evaluateConditionIf(showIf, { values: { effectKind: EFFECT_KIND.END_EFFECTS } })).toBe(
        true
      )
      expect(
        evaluateConditionIf(showIf, { values: { effectKind: EFFECT_KIND.RESTORE_RESOURCE } })
      ).toBe(false)
    }
  })

  it('declares explicit authoring presentation for effect groups', () => {
    const effectsNode = SPELL_NODE_MAP.nodes.effects
    const invocationNode = EFFECT_NODE_MAP.nodes.invocation
    const pathsNode = EFFECT_NODE_MAP.nodes.paths
    const levelsNode = PATH_NODE_MAP.nodes.resultBlock

    expect(effectsNode.kind).toBe('GROUP')
    expect(invocationNode.kind).toBe('GROUP')
    expect(pathsNode.kind).toBe('GROUP')
    expect(effectsNode.kind === 'GROUP' && effectsNode.presentation).toBe('branch')
    expect(invocationNode.kind === 'GROUP' && invocationNode.presentation).toBe('inline')
    expect(pathsNode.kind === 'GROUP' && pathsNode.presentation).toBe('branch')
    expect(levelsNode.kind === 'GROUP' && levelsNode.presentation).toBe('inline')
  })

  it('exposes resource use only on action invocations', () => {
    const invocationNode = EFFECT_NODE_MAP.nodes.invocation

    if (invocationNode.kind !== 'GROUP') {
      throw new Error('Expected invocation to be a group node')
    }

    const invocationMap =
      typeof invocationNode.nodes === 'function' ? invocationNode.nodes() : invocationNode.nodes
    const resourceUseNode = invocationMap.nodes.resourceUse

    expect(resourceUseNode?.kind).toBe('GROUP')
    expect(resourceUseNode?.kind === 'GROUP' && resourceUseNode.presentation).toBe('inline')
    expect(resourceUseNode?.kind === 'GROUP' && resourceUseNode.showIf).toBeDefined()
  })

  it('offers the reaction trigger as a conditional group with its attacked-self kind', () => {
    const invocationNode = EFFECT_NODE_MAP.nodes.invocation

    if (invocationNode.kind !== 'GROUP') {
      throw new Error('Expected invocation to be a group node')
    }

    const invocationMap =
      typeof invocationNode.nodes === 'function' ? invocationNode.nodes() : invocationNode.nodes
    const reactionTriggerNode = invocationMap.nodes.reactionTrigger

    if (reactionTriggerNode?.kind !== 'GROUP') {
      throw new Error('Expected reactionTrigger to be a group node')
    }
    expect(reactionTriggerNode.presentation).toBe('inline')
    expect(reactionTriggerNode.showIf).toBeDefined()
    // Optional while the trigger union is incomplete (workbook slice-reaction-4.md, premise change 2026-10-15).
    expect(reactionTriggerNode.requiredIf).toBeUndefined()

    const reactionMap =
      typeof reactionTriggerNode.nodes === 'function'
        ? reactionTriggerNode.nodes()
        : reactionTriggerNode.nodes
    const kindNode = reactionMap.nodes.kind
    if (
      kindNode.kind !== 'INPUT' ||
      kindNode.type !== 'SELECT_SINGLE' ||
      kindNode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected the reaction trigger kind to be an inline select')
    }
    expect(kindNode.source.options.map((option) => option.code)).toEqual([
      'MOVEMENT',
      'ATTACKED_SELF',
      'SPELL_CAST',
      'DAMAGE_TAKEN',
      'TARGETED_SELF'
    ])
    const sourceEffectIdsNode = reactionMap.nodes.sourceEffectIds
    if (sourceEffectIdsNode?.kind !== 'INPUT' || sourceEffectIdsNode.type !== 'SELECT_MULTI')
      throw new Error('Expected the source spells to be a multi select')
    expect(sourceEffectIdsNode.source).toMatchObject({
      kind: 'DATA',
      relationship: { kind: 'TABLE', table: 'spells' }
    })
    expect(sourceEffectIdsNode.showIf).toBeDefined()
    expect(sourceEffectIdsNode.requiredIf).toBeUndefined()
    const higherLevelCheckNode = reactionMap.nodes.higherLevelCheck
    if (higherLevelCheckNode?.kind !== 'GROUP')
      throw new Error('Expected the higher-level check to be a group node')
    expect(higherLevelCheckNode.presentation).toBe('inline')
    expect(higherLevelCheckNode.showIf).toBeDefined()
    const damageTypesNode = reactionMap.nodes.damageTypeIds
    if (damageTypesNode?.kind !== 'INPUT' || damageTypesNode.type !== 'SELECT_MULTI')
      throw new Error('Expected the damage types to be a multi select')
    expect(damageTypesNode.source).toMatchObject({
      kind: 'DATA',
      relationship: { kind: 'TABLE', table: 'damage_types' }
    })
    expect(damageTypesNode.showIf).toBeDefined()
    expect(damageTypesNode.requiredIf).toBeDefined()
  })

  it('exposes result structure on all effect result blocks', () => {
    const directResultNode = PATH_NODE_MAP.nodes.resultBlock
    const choiceOptionsNode = PATH_NODE_MAP.nodes.options
    const rollRowsNode = PATH_NODE_MAP.nodes.rows
    const nestedPathsNode = MANIFEST_NESTED_EFFECT_NODE_MAP.nodes.paths

    if (!directResultNode || directResultNode.kind !== 'GROUP') {
      throw new Error('Expected direct result block to be a group node')
    }

    if (!choiceOptionsNode || choiceOptionsNode.kind !== 'GROUP') {
      throw new Error('Expected choice options to be a group node')
    }

    if (!rollRowsNode || rollRowsNode.kind !== 'GROUP') {
      throw new Error('Expected roll rows to be a group node')
    }

    if (!nestedPathsNode || nestedPathsNode.kind !== 'GROUP') {
      throw new Error('Expected nested paths to be a group node')
    }

    const directResultMap =
      typeof directResultNode.nodes === 'function'
        ? directResultNode.nodes()
        : directResultNode.nodes

    const choiceOptionMap =
      typeof choiceOptionsNode.nodes === 'function'
        ? choiceOptionsNode.nodes()
        : choiceOptionsNode.nodes

    const rollRowMap =
      typeof rollRowsNode.nodes === 'function' ? rollRowsNode.nodes() : rollRowsNode.nodes

    const nestedPathMap =
      typeof nestedPathsNode.nodes === 'function' ? nestedPathsNode.nodes() : nestedPathsNode.nodes

    const choiceResultNode = choiceOptionMap.nodes.resultBlock
    const rollResultNode = rollRowMap.nodes.resultBlock
    const nestedDirectResultNode = nestedPathMap.nodes.resultBlock
    const nestedChoiceOptionsNode = nestedPathMap.nodes.options
    const nestedRollRowsNode = nestedPathMap.nodes.rows

    if (!choiceResultNode || choiceResultNode.kind !== 'GROUP') {
      throw new Error('Expected choice result block to be a group node')
    }

    if (!rollResultNode || rollResultNode.kind !== 'GROUP') {
      throw new Error('Expected roll result block to be a group node')
    }

    if (!nestedDirectResultNode || nestedDirectResultNode.kind !== 'GROUP') {
      throw new Error('Expected nested direct result block to be a group node')
    }

    if (!nestedChoiceOptionsNode || nestedChoiceOptionsNode.kind !== 'GROUP') {
      throw new Error('Expected nested choice options to be a group node')
    }

    if (!nestedRollRowsNode || nestedRollRowsNode.kind !== 'GROUP') {
      throw new Error('Expected nested roll rows to be a group node')
    }

    const choiceResultMap =
      typeof choiceResultNode.nodes === 'function'
        ? choiceResultNode.nodes()
        : choiceResultNode.nodes

    const rollResultMap =
      typeof rollResultNode.nodes === 'function' ? rollResultNode.nodes() : rollResultNode.nodes

    const nestedDirectResultMap =
      typeof nestedDirectResultNode.nodes === 'function'
        ? nestedDirectResultNode.nodes()
        : nestedDirectResultNode.nodes

    const nestedChoiceOptionMap =
      typeof nestedChoiceOptionsNode.nodes === 'function'
        ? nestedChoiceOptionsNode.nodes()
        : nestedChoiceOptionsNode.nodes

    const nestedRollRowMap =
      typeof nestedRollRowsNode.nodes === 'function'
        ? nestedRollRowsNode.nodes()
        : nestedRollRowsNode.nodes

    const nestedChoiceResultNode = nestedChoiceOptionMap.nodes.resultBlock
    const nestedRollResultNode = nestedRollRowMap.nodes.resultBlock

    if (!nestedChoiceResultNode || nestedChoiceResultNode.kind !== 'GROUP') {
      throw new Error('Expected nested choice result block to be a group node')
    }

    if (!nestedRollResultNode || nestedRollResultNode.kind !== 'GROUP') {
      throw new Error('Expected nested roll result block to be a group node')
    }

    const nestedChoiceResultMap =
      typeof nestedChoiceResultNode.nodes === 'function'
        ? nestedChoiceResultNode.nodes()
        : nestedChoiceResultNode.nodes

    const nestedRollResultMap =
      typeof nestedRollResultNode.nodes === 'function'
        ? nestedRollResultNode.nodes()
        : nestedRollResultNode.nodes

    for (const resultMap of [
      directResultMap,
      choiceResultMap,
      rollResultMap,
      nestedDirectResultMap,
      nestedChoiceResultMap,
      nestedRollResultMap
    ]) {
      const resultKindNode = resultMap.nodes.resultKind
      expect(resultKindNode?.kind).toBe('INPUT')
      if (!resultKindNode || resultKindNode.kind !== 'INPUT') {
        throw new Error('Expected result structure to be an input node')
      }
      expect(resultKindNode.type).toBe('SELECT_SINGLE')
    }
  })

  it('omits MANIFEST from manifest-nested behavior effect kind options', () => {
    const pathsNode = MANIFEST_NESTED_EFFECT_NODE_MAP.nodes.paths

    expect(pathsNode.kind).toBe('GROUP')
    if (pathsNode.kind !== 'GROUP') {
      throw new Error('Expected paths to be a group node')
    }

    const pathMap = typeof pathsNode.nodes === 'function' ? pathsNode.nodes() : pathsNode.nodes

    const optionsNode = pathMap.nodes.options
    const rowsNode = pathMap.nodes.rows

    if (!optionsNode || optionsNode.kind !== 'GROUP') {
      throw new Error('Expected choice options to be a group node')
    }

    if (!rowsNode || rowsNode.kind !== 'GROUP') {
      throw new Error('Expected roll-table rows to be a group node')
    }

    const choiceOptionMap =
      typeof optionsNode.nodes === 'function' ? optionsNode.nodes() : optionsNode.nodes

    const rollRowMap = typeof rowsNode.nodes === 'function' ? rowsNode.nodes() : rowsNode.nodes

    const choiceResultNode = choiceOptionMap.nodes.resultBlock
    const rollResultNode = rollRowMap.nodes.resultBlock

    if (!choiceResultNode || choiceResultNode.kind !== 'GROUP') {
      throw new Error('Expected choice result block to be a group node')
    }

    if (!rollResultNode || rollResultNode.kind !== 'GROUP') {
      throw new Error('Expected roll row result block to be a group node')
    }

    const choiceResultMap =
      typeof choiceResultNode.nodes === 'function'
        ? choiceResultNode.nodes()
        : choiceResultNode.nodes

    const rollResultMap =
      typeof rollResultNode.nodes === 'function' ? rollResultNode.nodes() : rollResultNode.nodes

    const choiceOutcomesNode = choiceResultMap.nodes.outcomes
    const rollOutcomesNode = rollResultMap.nodes.outcomes

    if (!choiceOutcomesNode || choiceOutcomesNode.kind !== 'GROUP') {
      throw new Error('Expected choice outcomes to be a group node')
    }

    if (!rollOutcomesNode || rollOutcomesNode.kind !== 'GROUP') {
      throw new Error('Expected roll outcomes to be a group node')
    }

    expect(choiceOutcomesNode.presentation).toBe('summary')
    expect(rollOutcomesNode.presentation).toBe('summary')

    const choiceOutcomeMap =
      typeof choiceOutcomesNode.nodes === 'function'
        ? choiceOutcomesNode.nodes()
        : choiceOutcomesNode.nodes

    const rollOutcomeMap =
      typeof rollOutcomesNode.nodes === 'function'
        ? rollOutcomesNode.nodes()
        : rollOutcomesNode.nodes

    const directEffectKindNode = choiceOutcomeMap.nodes.effectKind
    const rollTableEffectKindNode = rollOutcomeMap.nodes.effectKind

    if (
      directEffectKindNode.kind !== 'INPUT' ||
      directEffectKindNode.type !== 'SELECT_SINGLE' ||
      directEffectKindNode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected direct effect kind to be an inline select')
    }

    if (
      rollTableEffectKindNode.kind !== 'INPUT' ||
      rollTableEffectKindNode.type !== 'SELECT_SINGLE' ||
      rollTableEffectKindNode.source.kind !== 'INLINE_OPTIONS'
    ) {
      throw new Error('Expected roll-table effect kind to be an inline select')
    }

    const directCodes = directEffectKindNode.source.options.map((option) => option.code)
    const rollTableCodes = rollTableEffectKindNode.source.options.map((option) => option.code)

    expect(directCodes).not.toContain(EFFECT_KIND.MANIFEST)
    expect(rollTableCodes).not.toContain(EFFECT_KIND.MANIFEST)
  })

  it('requires an attachment only on ZONE manifests', () => {
    const resultNode = PATH_NODE_MAP.nodes.resultBlock

    if (!resultNode || resultNode.kind !== 'GROUP') {
      throw new Error('Expected result block to be a group node')
    }

    const resultMap = typeof resultNode.nodes === 'function' ? resultNode.nodes() : resultNode.nodes
    const outcomesNode = resultMap.nodes.outcomes

    if (!outcomesNode || outcomesNode.kind !== 'GROUP') {
      throw new Error('Expected outcomes to be a group node')
    }

    const outcomeMap =
      typeof outcomesNode.nodes === 'function' ? outcomesNode.nodes() : outcomesNode.nodes
    const attachmentNode = outcomeMap.nodes.attachmentKind

    if (attachmentNode.kind !== 'INPUT') {
      throw new Error('Expected attachment to be an input node')
    }

    const requiredIf = attachmentNode.requiredIf
    expect(requiredIf).toBeDefined()
    if (!requiredIf || requiredIf === true) {
      throw new Error('Expected attachment to be conditionally required')
    }

    const manifest = (manifestKind: string) => ({
      values: { effectKind: EFFECT_KIND.MANIFEST, manifestKind }
    })

    expect(evaluateConditionIf(requiredIf, manifest(MANIFEST_KIND.ZONE))).toBe(true)
    for (const manifestKind of [
      MANIFEST_KIND.CREATURE,
      MANIFEST_KIND.SUMMON,
      MANIFEST_KIND.SENSOR,
      MANIFEST_KIND.WEAPON,
      MANIFEST_KIND.OBJECT,
      MANIFEST_KIND.ILLUSION
    ]) {
      expect(evaluateConditionIf(requiredIf, manifest(manifestKind))).toBe(false)
    }
  })
})
