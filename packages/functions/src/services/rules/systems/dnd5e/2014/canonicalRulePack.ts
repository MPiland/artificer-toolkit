import { rulePackDocumentDtoSchema } from '@artificer-toolkit/schema/api/rules'
import { ENCOUNTER_ACTOR_MODEL_KEY } from '@artificer-toolkit/schema/api/encounterActorRules'

import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import {
  dnd5e2014EncounterActorFixture,
  dnd5e2014EncounterActorModel
} from './encounterActorSource.js'

export const dnd5e2014CanonicalRulePackDocument = rulePackDocumentDtoSchema.parse({
  schemaVersion: 1,
  models: {
    ...dnd5e2014CharacterPolicyDocument.models,
    [ENCOUNTER_ACTOR_MODEL_KEY]: dnd5e2014EncounterActorModel
  },
  fixtures: [...dnd5e2014CharacterPolicyDocument.fixtures, dnd5e2014EncounterActorFixture]
})
