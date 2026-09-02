import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'

export const DND5E2014_ENCOUNTER_ACTOR_SOURCE = String.raw`/** @type {Handler} */
export const handler = async (input) => {
  const clampInteger = (value, minimum, maximum) => {
    let result = value;
    if (minimum != null) result = Math.max(result, minimum);
    if (maximum != null) result = Math.min(result, maximum);
    return Math.floor(result);
  };
  const abilityModifier = (score) => Math.floor((score - 10) / 2);
  const resolveMaximum = (charge, abilities) => {
    if (
      charge == null ||
      charge.limitKind === 'SOURCE_CHARGES' ||
      charge.scalingKind !== 'NONE' ||
      (charge.limitKind !== 'FIXED_AMOUNT' && charge.limitKind !== 'ABILITY_MODIFIER') ||
      (charge.bonuses || []).some((bonus) => bonus.bonusKind !== 'ABILITY_MODIFIER')
    ) return null;

    let maximum;
    if (charge.limitKind === 'FIXED_AMOUNT') {
      maximum = charge.amount;
    } else {
      const score = abilities[charge.ability];
      if (score == null) return null;
      maximum = clampInteger(
        abilityModifier(score) * (charge.multiplier == null ? 1 : charge.multiplier),
        charge.min,
        charge.max
      );
    }

    for (const bonus of charge.bonuses || []) {
      const score = abilities[bonus.ability];
      if (score == null) return null;
      maximum += clampInteger(
        abilityModifier(score) * (bonus.multiplier == null ? 1 : bonus.multiplier),
        bonus.min,
        bonus.max
      );
    }

    return Math.max(0, Math.floor(maximum));
  };

  return {
    actors: input.actors.map((actor) => ({
      actorId: actor.actorId,
      initiativeModifier:
        actor.initiativeAbilityDefinitionId == null || actor.abilityScores[actor.initiativeAbilityDefinitionId] == null
          ? 0
          : abilityModifier(actor.abilityScores[actor.initiativeAbilityDefinitionId]),
      savingThrowDefinitions: Object.entries(actor.abilityScores).sort(([left], [right]) => left.localeCompare(right)).map(([abilityDefinitionId, score]) => ({
        abilityDefinitionId,
        modifier: abilityModifier(score),
        rollMode: 'NORMAL',
        contributors: []
      })),
      targetProtection: actor.targetProtection,
      featureResources: actor.featureResources.map((feature) => {
        const maximum = resolveMaximum(feature.charge, actor.resourceAbilityScores ?? {});
        const used = maximum == null ? 0 : feature.used;
        return {
          featureId: feature.featureId,
          maximum,
          reconciliationPolicy: maximum == null ? null : 'CLAMP_USED_TO_MAXIMUM',
          rawUsed: feature.used,
          used,
          remaining: maximum == null ? null : Math.max(0, maximum - used),
          resetKind: maximum == null ? null : feature.charge.resetKind
        };
      })
    }))
  };
};`

export const dnd5e2014EncounterActorModel: RulePackDocumentDto['models'][string] = {
  contentType: 'application/vnd.gorules.decision',
  nodes: [
    {
      id: 'input',
      type: 'inputNode',
      name: 'Encounter actor facts',
      position: { x: 0, y: 0 },
      content: { schema: '' }
    },
    {
      id: 'encounter-actor-function',
      type: 'functionNode',
      name: 'Resolve Encounter actors',
      position: { x: 180, y: 0 },
      content: { source: DND5E2014_ENCOUNTER_ACTOR_SOURCE }
    },
    {
      id: 'output',
      type: 'outputNode',
      name: 'Resolved Encounter actors',
      position: { x: 360, y: 0 },
      content: { schema: '' }
    }
  ],
  edges: [
    {
      id: 'input-encounter-actor-function',
      sourceId: 'input',
      targetId: 'encounter-actor-function'
    },
    {
      id: 'encounter-actor-function-output',
      sourceId: 'encounter-actor-function',
      targetId: 'output'
    }
  ]
}

export const dnd5e2014EncounterActorFixture: RulePackDocumentDto['fixtures'][number] = {
  id: '8636dd0f-782e-4e51-893c-c28efeb84430',
  label: 'Encounter actor initiative and feature resources',
  modelKey: ENCOUNTER_ACTOR_MODEL_KEY,
  input: {
    contractVersion: 1,
    actors: [
      {
        actorId: '00000000-0000-4000-8000-000000000001',
        abilityScores: {
          '00000000-0000-0000-0011-000200000000': 14,
          '00000000-0000-0000-0011-000600000000': 18
        },
        checkTotals: {},
        resourceAbilityScores: { DEXTERITY: 14, CHARISMA: 18 },
        initiativeAbilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        targetProtection: {
          status: 'NORMALIZED',
          defenses: [],
          conditionImmunityIds: []
        },
        featureResources: [
          {
            featureId: 'legendary-resistance',
            charge: {
              id: 'legendary-resistance-charges',
              resetKind: 'DAILY',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 1,
              bonuses: [
                {
                  id: 'charisma-bonus',
                  bonusKind: 'ABILITY_MODIFIER',
                  ability: 'CHARISMA',
                  order: 0
                }
              ]
            },
            used: 2
          }
        ]
      }
    ]
  },
  expected: {
    actors: [
      {
        actorId: '00000000-0000-4000-8000-000000000001',
        initiativeModifier: 2,
        savingThrowDefinitions: [
          {
            abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
            modifier: 2,
            rollMode: 'NORMAL',
            contributors: []
          },
          {
            abilityDefinitionId: '00000000-0000-0000-0011-000600000000',
            modifier: 4,
            rollMode: 'NORMAL',
            contributors: []
          }
        ],
        targetProtection: {
          status: 'NORMALIZED',
          defenses: [],
          conditionImmunityIds: []
        },
        featureResources: [
          {
            featureId: 'legendary-resistance',
            maximum: 5,
            reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
            rawUsed: 2,
            used: 2,
            remaining: 3,
            resetKind: 'DAILY'
          }
        ]
      }
    ]
  }
}
