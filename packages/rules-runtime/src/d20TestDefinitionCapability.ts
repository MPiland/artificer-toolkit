import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'

/** A System's d20 test graphs: each asks for its d20, then the dice its roller's effects add (D156). */
export interface D20TestDefinitionCapabilityAdapter {
  gameSystemId: string
  basicActionCheckDefinition(): ServerPublishedRuleDefinitionDto
  /** Absent for a System without death saves: its dying Characters roll none. */
  deathSaveDefinition?: () => ServerPublishedRuleDefinitionDto
  /** The facts a test's added dice bind; a test that is not attempted rolls none. */
  addedDiceFacts(
    dice: readonly D20AddedDieDto[],
    attempted?: boolean
  ): Record<string, number | boolean>
}
