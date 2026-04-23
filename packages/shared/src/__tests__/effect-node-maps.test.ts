import { describe, expect, it } from 'vitest'

import { EFFECT_KIND } from '#core'
import { MANIFEST_NESTED_EFFECT_NODE_MAP, PATH_NODE_MAP } from '#maps'

describe('effect node maps', () => {
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

    const directResultMap = typeof directResultNode.nodes === 'function'
      ? directResultNode.nodes()
      : directResultNode.nodes

    const choiceOptionMap = typeof choiceOptionsNode.nodes === 'function'
      ? choiceOptionsNode.nodes()
      : choiceOptionsNode.nodes

    const rollRowMap = typeof rollRowsNode.nodes === 'function'
      ? rollRowsNode.nodes()
      : rollRowsNode.nodes

    const nestedPathMap = typeof nestedPathsNode.nodes === 'function'
      ? nestedPathsNode.nodes()
      : nestedPathsNode.nodes

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

    const choiceResultMap = typeof choiceResultNode.nodes === 'function'
      ? choiceResultNode.nodes()
      : choiceResultNode.nodes

    const rollResultMap = typeof rollResultNode.nodes === 'function'
      ? rollResultNode.nodes()
      : rollResultNode.nodes

    const nestedDirectResultMap = typeof nestedDirectResultNode.nodes === 'function'
      ? nestedDirectResultNode.nodes()
      : nestedDirectResultNode.nodes

    const nestedChoiceOptionMap = typeof nestedChoiceOptionsNode.nodes === 'function'
      ? nestedChoiceOptionsNode.nodes()
      : nestedChoiceOptionsNode.nodes

    const nestedRollRowMap = typeof nestedRollRowsNode.nodes === 'function'
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

    const nestedChoiceResultMap = typeof nestedChoiceResultNode.nodes === 'function'
      ? nestedChoiceResultNode.nodes()
      : nestedChoiceResultNode.nodes

    const nestedRollResultMap = typeof nestedRollResultNode.nodes === 'function'
      ? nestedRollResultNode.nodes()
      : nestedRollResultNode.nodes

    for (const resultMap of [
      directResultMap,
      choiceResultMap,
      rollResultMap,
      nestedDirectResultMap,
      nestedChoiceResultMap,
      nestedRollResultMap,
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

    const pathMap = typeof pathsNode.nodes === 'function'
      ? pathsNode.nodes()
      : pathsNode.nodes

    const optionsNode = pathMap.nodes.options
    const rowsNode = pathMap.nodes.rows

    if (!optionsNode || optionsNode.kind !== 'GROUP') {
      throw new Error('Expected choice options to be a group node')
    }

    if (!rowsNode || rowsNode.kind !== 'GROUP') {
      throw new Error('Expected roll-table rows to be a group node')
    }

    const choiceOptionMap = typeof optionsNode.nodes === 'function'
      ? optionsNode.nodes()
      : optionsNode.nodes

    const rollRowMap = typeof rowsNode.nodes === 'function'
      ? rowsNode.nodes()
      : rowsNode.nodes

    const choiceResultNode = choiceOptionMap.nodes.resultBlock
    const rollResultNode = rollRowMap.nodes.resultBlock

    if (!choiceResultNode || choiceResultNode.kind !== 'GROUP') {
      throw new Error('Expected choice result block to be a group node')
    }

    if (!rollResultNode || rollResultNode.kind !== 'GROUP') {
      throw new Error('Expected roll row result block to be a group node')
    }

    const choiceResultMap = typeof choiceResultNode.nodes === 'function'
      ? choiceResultNode.nodes()
      : choiceResultNode.nodes

    const rollResultMap = typeof rollResultNode.nodes === 'function'
      ? rollResultNode.nodes()
      : rollResultNode.nodes

    const choiceOutcomesNode = choiceResultMap.nodes.outcomes
    const rollOutcomesNode = rollResultMap.nodes.outcomes

    if (!choiceOutcomesNode || choiceOutcomesNode.kind !== 'GROUP') {
      throw new Error('Expected choice outcomes to be a group node')
    }

    if (!rollOutcomesNode || rollOutcomesNode.kind !== 'GROUP') {
      throw new Error('Expected roll outcomes to be a group node')
    }

    const choiceOutcomeMap = typeof choiceOutcomesNode.nodes === 'function'
      ? choiceOutcomesNode.nodes()
      : choiceOutcomesNode.nodes

    const rollOutcomeMap = typeof rollOutcomesNode.nodes === 'function'
      ? rollOutcomesNode.nodes()
      : rollOutcomesNode.nodes

    const directEffectKindNode = choiceOutcomeMap.nodes.effectKind
    const rollTableEffectKindNode = rollOutcomeMap.nodes.effectKind

    if (
      directEffectKindNode.kind !== 'INPUT'
      || directEffectKindNode.type !== 'SELECT_SINGLE'
      || directEffectKindNode.source.kind !== 'INLINE'
      || !('options' in directEffectKindNode.source)
    ) {
      throw new Error('Expected direct effect kind to be an inline select')
    }

    if (
      rollTableEffectKindNode.kind !== 'INPUT'
      || rollTableEffectKindNode.type !== 'SELECT_SINGLE'
      || rollTableEffectKindNode.source.kind !== 'INLINE'
      || !('options' in rollTableEffectKindNode.source)
    ) {
      throw new Error('Expected roll-table effect kind to be an inline select')
    }

    const directCodes = directEffectKindNode.source.options.map((option) => option.code)
    const rollTableCodes = rollTableEffectKindNode.source.options.map((option) => option.code)

    expect(directCodes).not.toContain(EFFECT_KIND.MANIFEST)
    expect(rollTableCodes).not.toContain(EFFECT_KIND.MANIFEST)
  })
})

