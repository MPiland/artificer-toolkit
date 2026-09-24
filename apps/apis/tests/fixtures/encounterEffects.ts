import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

export const encounterEffectCreatureId = '00000000-0000-4000-8000-0000000008b0'
export const encounterEffectFeatureId = '00000000-0000-4000-8000-0000000008b1'
export const encounterEffectId = '00000000-0000-4000-8000-0000000008b2'

const bite = wolf.features?.find((feature) => feature.label === 'Bite')
const dexterity = srdSystemRecord.abilities?.find((ability) => ability.code === 'DEXTERITY')
const frightened = srdSystemRecord.conditionTypes.find(
  (condition) => condition.code === 'FRIGHTENED'
)

if (!bite || !dexterity || !frightened)
  throw new Error('The action-effect fixture requires SRD Wolf Bite, Dexterity, and Frightened.')

export const encounterEffectCreature = {
  ...wolf,
  id: encounterEffectCreatureId,
  label: 'Action-effect creature',
  features: wolf.features?.map((feature) =>
    feature.id !== bite.id
      ? feature
      : {
          ...feature,
          id: encounterEffectFeatureId,
          effects: feature.effects?.slice(0, 1).map((effect) => ({
            ...effect,
            id: encounterEffectId,
            invocation: {
              ...effect.invocation,
              triggerCode: 'SAVING_THROW' as const,
              savingThrow: {
                id: '00000000-0000-4000-8000-0000000008b3',
                dcMethod: 'FIXED_DC' as const,
                abilityDefinitionId: dexterity.id,
                baseDc: 10
              },
              range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              }
            },
            paths: [
              {
                id: '00000000-0000-4000-8000-0000000008b4',
                order: 1,
                pathCode: 'ON_SAVE_FAIL' as const,
                groupType: 'SEQUENTIAL' as const,
                originKind: 'SOURCE' as const,
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: '00000000-0000-4000-8000-0000000008b5',
                  resultKind: 'SEQUENCE' as const,
                  duration: {
                    id: '00000000-0000-4000-8000-0000000008b6',
                    durationKind: 'ROUND' as const,
                    amount: 10
                  },
                  outcomes: [
                    {
                      id: '00000000-0000-4000-8000-0000000008b7',
                      effectKind: 'CONDITION' as const,
                      conditionId: frightened.id
                    },
                    {
                      id: '00000000-0000-4000-8000-0000000008b8',
                      effectKind: 'FOLLOW_UP_SAVE' as const,
                      timing: 'TARGET_TURN_END' as const,
                      savingThrow: {
                        id: '00000000-0000-4000-8000-0000000008b9',
                        dcMethod: 'FIXED_DC' as const,
                        abilityDefinitionId: dexterity.id,
                        baseDc: 10
                      },
                      attempts: { kind: 'ONCE' as const, repeatOnFailure: true },
                      onSuccess: { kind: 'END' as const },
                      onFailure: { kind: 'CONTINUE' as const },
                      onDurationComplete: { kind: 'END' as const }
                    }
                  ]
                }
              }
            ]
          }))
        }
  )
}
