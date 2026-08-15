import {
  activateRulePackRevisionInputDtoSchema,
  listRulePackRevisionsInputDtoSchema,
  retireRulePackInputDtoSchema,
  rulePackRevisionDtoSchema,
  rulePackSummaryDtoSchema,
  saveRulePackDraftInputDtoSchema,
  simulateRulePackInputDtoSchema,
  simulateRulePackResultDtoSchema,
  type ActivateRulePackRevisionInputDto,
  type RetireRulePackInputDto,
  type SaveRulePackDraftInputDto,
  type SimulateRulePackInputDto
} from '@artificer-toolkit/schema/api/rules'
import { okResponseSchema, request, type TrpcClient } from './transport'

export function buildRulesApi(client: TrpcClient) {
  return {
    listPacks: () =>
      request('rules.listPacks', rulePackSummaryDtoSchema.array(), () =>
        client.rules.listPacks.query()
      ),
    listRevisions: (packId: string) =>
      request('rules.listRevisions', rulePackRevisionDtoSchema.array(), () =>
        client.rules.listRevisions.query(listRulePackRevisionsInputDtoSchema.parse({ packId }))
      ),
    getRevision: (revisionId: string) =>
      request('rules.getRevision', rulePackRevisionDtoSchema, () =>
        client.rules.getRevision.query({ revisionId })
      ),
    saveDraft: (input: SaveRulePackDraftInputDto) =>
      request('rules.saveDraft', rulePackRevisionDtoSchema, () =>
        client.rules.saveDraft.mutate(saveRulePackDraftInputDtoSchema.parse(input))
      ),
    simulate: (input: SimulateRulePackInputDto) =>
      request('rules.simulate', simulateRulePackResultDtoSchema, () =>
        client.rules.simulate.mutate(simulateRulePackInputDtoSchema.parse(input))
      ),
    activate: (input: ActivateRulePackRevisionInputDto) =>
      request('rules.activate', rulePackRevisionDtoSchema, () =>
        client.rules.activate.mutate(activateRulePackRevisionInputDtoSchema.parse(input))
      ),
    retire: (input: RetireRulePackInputDto) =>
      request('rules.retire', okResponseSchema, () =>
        client.rules.retire.mutate(retireRulePackInputDtoSchema.parse(input))
      )
  }
}
