/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedMutation<InputType, OutputType> = string & {
    __generatedMutationInput: InputType;
    __generatedMutationOutput: OutputType;
  };

export const createMasterSystem = /* GraphQL */ `
mutation CreateMasterSystem($input: SystemInput!) {
  createMasterSystem(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterSystemArgs, {createMasterSystem: APITypes.Mutation['createMasterSystem']}>;

export const updateMasterSystem = /* GraphQL */ `
mutation UpdateMasterSystem($input: SystemInput!) {
  updateMasterSystem(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterSystemArgs, {updateMasterSystem: APITypes.Mutation['updateMasterSystem']}>;

export const deleteMasterSystem = /* GraphQL */ `
mutation DeleteMasterSystem($id: ID!) {
  deleteMasterSystem(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterSystemArgs, {deleteMasterSystem: APITypes.Mutation['deleteMasterSystem']}>;

export const batchCreateMasterSystems = /* GraphQL */ `
mutation BatchCreateMasterSystems($input: BatchSystemsInput!) {
  batchCreateMasterSystems(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterSystemsArgs, {batchCreateMasterSystems: APITypes.Mutation['batchCreateMasterSystems']}>;

export const createSystem = /* GraphQL */ `
mutation CreateSystem($input: SystemInput!) {
  createSystem(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateSystemArgs, {createSystem: APITypes.Mutation['createSystem']}>;

export const updateSystem = /* GraphQL */ `
mutation UpdateSystem($input: SystemInput!) {
  updateSystem(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateSystemArgs, {updateSystem: APITypes.Mutation['updateSystem']}>;

export const deleteSystem = /* GraphQL */ `
mutation DeleteSystem($id: ID!) {
  deleteSystem(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteSystemArgs, {deleteSystem: APITypes.Mutation['deleteSystem']}>;

export const batchCreateSystems = /* GraphQL */ `
mutation BatchCreateSystems($input: BatchSystemsInput!) {
  batchCreateSystems(input: $input) {
	__typename
	id
	label
	desc
	abilities {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	alignments {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	categories {
		__typename
		id
		label
		features
		classes
		races
	}
	characters {
		__typename
		hitpointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	charges {
		__typename
		resets {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
		limits {
			__typename
			id
			label
			features
			damage
			feats
			sections
			spells
			equipment
			classes
		}
	}
	conditions {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		label
		desc
		abbreviation
		conversions {
			__typename
			copper
			silver
			gold
			electrum
			platinum
		}
	}
	damageTypes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	equipment {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryProperties {
			__typename
			id
			propertyId
			categoryId
		}
		rarities {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	modifiers {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		categoryTypes {
			__typename
			id
			typeId
			categoryId
		}
		typeMethods {
			__typename
			id
			typeId
			methodId
		}
		categoryMethods {
			__typename
			id
			methodId
			typeId
			categoryId
		}
	}
	passives {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		label
		features
		damage
		feats
		sections
		spells
		equipment
		classes
	}
	proficiencies {
		__typename
		levels {
			__typename
			id
			label
			multiplier
		}
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	rules {
		__typename
		measurements {
			__typename
			amount {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				label
				desc
				tooltip
				short
			}
			imperial {
				__typename
				weight {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					label
					desc
					tooltip
					short
				}
			}
		}
		abilityGenerateMethod {
			__typename
			id
			label
			total
			options {
				__typename
				id
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	spells {
		__typename
		categories {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		label
		desc
		tooltip
		short
	}
	ownerId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateSystemsArgs, {batchCreateSystems: APITypes.Mutation['batchCreateSystems']}>;

export const createMasterSpell = /* GraphQL */ `
mutation CreateMasterSpell($input: SpellInput!) {
  createMasterSpell(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterSpellArgs, {createMasterSpell: APITypes.Mutation['createMasterSpell']}>;

export const updateMasterSpell = /* GraphQL */ `
mutation UpdateMasterSpell($input: SpellInput!) {
  updateMasterSpell(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterSpellArgs, {updateMasterSpell: APITypes.Mutation['updateMasterSpell']}>;

export const deleteMasterSpell = /* GraphQL */ `
mutation DeleteMasterSpell($id: ID!) {
  deleteMasterSpell(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterSpellArgs, {deleteMasterSpell: APITypes.Mutation['deleteMasterSpell']}>;

export const batchCreateMasterSpells = /* GraphQL */ `
mutation BatchCreateMasterSpells($input: BatchSpellsInput!) {
  batchCreateMasterSpells(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterSpellsArgs, {batchCreateMasterSpells: APITypes.Mutation['batchCreateMasterSpells']}>;

export const createSpell = /* GraphQL */ `
mutation CreateSpell($input: SpellInput!) {
  createSpell(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateSpellArgs, {createSpell: APITypes.Mutation['createSpell']}>;

export const updateSpell = /* GraphQL */ `
mutation UpdateSpell($input: SpellInput!) {
  updateSpell(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateSpellArgs, {updateSpell: APITypes.Mutation['updateSpell']}>;

export const deleteSpell = /* GraphQL */ `
mutation DeleteSpell($id: ID!) {
  deleteSpell(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteSpellArgs, {deleteSpell: APITypes.Mutation['deleteSpell']}>;

export const batchCreateSpells = /* GraphQL */ `
mutation BatchCreateSpells($input: BatchSpellsInput!) {
  batchCreateSpells(input: $input) {
	__typename
	id
	label
	desc
	level
	school
	classes
	attributes
	upcast {
		__typename
		attributes
		levels {
			__typename
			level
			damage {
				__typename
				attributes
				damageSave
				setPerLevel {
					__typename
					level
					primary
					secondary
					bonus
				}
				diePerLevel {
					__typename
					level
					primary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					secondary {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
					bonus {
						__typename
						dieConfig
						attribute
						id
						ability
						setAmount
						multiplier
						minAmount
						maxAmount
						pool {
							__typename
							attribute
							setAmount
							multiplier
							minAmount
							maxAmount
							ability
							option
						}
					}
				}
				primary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				secondary {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				bonus {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
				versatile {
					__typename
					dieConfig
					attribute
					id
					ability
					setAmount
					multiplier
					minAmount
					maxAmount
					pool {
						__typename
						attribute
						setAmount
						multiplier
						minAmount
						maxAmount
						ability
						option
					}
				}
			}
			duration {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			range {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			shape {
				__typename
				id
				size
				unit
				amount
				minRange
				maxRange
				distance
			}
			targets
		}
	}
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	targets
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	conditions
	requirements
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	duration {
		__typename
		id
		amount
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	materialDesc
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateSpellsArgs, {batchCreateSpells: APITypes.Mutation['batchCreateSpells']}>;

export const createMasterRace = /* GraphQL */ `
mutation CreateMasterRace($input: RaceInput!) {
  createMasterRace(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterRaceArgs, {createMasterRace: APITypes.Mutation['createMasterRace']}>;

export const updateMasterRace = /* GraphQL */ `
mutation UpdateMasterRace($input: RaceInput!) {
  updateMasterRace(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterRaceArgs, {updateMasterRace: APITypes.Mutation['updateMasterRace']}>;

export const deleteMasterRace = /* GraphQL */ `
mutation DeleteMasterRace($id: ID!) {
  deleteMasterRace(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterRaceArgs, {deleteMasterRace: APITypes.Mutation['deleteMasterRace']}>;

export const batchCreateMasterRaces = /* GraphQL */ `
mutation BatchCreateMasterRaces($input: BatchRacesInput!) {
  batchCreateMasterRaces(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterRacesArgs, {batchCreateMasterRaces: APITypes.Mutation['batchCreateMasterRaces']}>;

export const createRace = /* GraphQL */ `
mutation CreateRace($input: RaceInput!) {
  createRace(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateRaceArgs, {createRace: APITypes.Mutation['createRace']}>;

export const updateRace = /* GraphQL */ `
mutation UpdateRace($input: RaceInput!) {
  updateRace(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateRaceArgs, {updateRace: APITypes.Mutation['updateRace']}>;

export const deleteRace = /* GraphQL */ `
mutation DeleteRace($id: ID!) {
  deleteRace(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteRaceArgs, {deleteRace: APITypes.Mutation['deleteRace']}>;

export const batchCreateRaces = /* GraphQL */ `
mutation BatchCreateRaces($input: BatchRacesInput!) {
  batchCreateRaces(input: $input) {
	__typename
	id
	label
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		desc
		options
	}
	details {
		__typename
		label
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			desc
		}
		size
		speeds {
			__typename
			walking
			swimming
			flying
			climbing
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateRacesArgs, {batchCreateRaces: APITypes.Mutation['batchCreateRaces']}>;

export const createMasterFeatureSpell = /* GraphQL */ `
mutation CreateMasterFeatureSpell($input: FeatureSpellInput!) {
  createMasterFeatureSpell(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureSpellArgs, {createMasterFeatureSpell: APITypes.Mutation['createMasterFeatureSpell']}>;

export const updateMasterFeatureSpell = /* GraphQL */ `
mutation UpdateMasterFeatureSpell($input: FeatureSpellInput!) {
  updateMasterFeatureSpell(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureSpellArgs, {updateMasterFeatureSpell: APITypes.Mutation['updateMasterFeatureSpell']}>;

export const deleteMasterFeatureSpell = /* GraphQL */ `
mutation DeleteMasterFeatureSpell($id: ID!) {
  deleteMasterFeatureSpell(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureSpellArgs, {deleteMasterFeatureSpell: APITypes.Mutation['deleteMasterFeatureSpell']}>;

export const batchCreateMasterFeatureSpells = /* GraphQL */ `
mutation BatchCreateMasterFeatureSpells($input: BatchFeatureSpellsInput!) {
  batchCreateMasterFeatureSpells(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureSpellsArgs, {batchCreateMasterFeatureSpells: APITypes.Mutation['batchCreateMasterFeatureSpells']}>;

export const createFeatureSpell = /* GraphQL */ `
mutation CreateFeatureSpell($input: FeatureSpellInput!) {
  createFeatureSpell(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureSpellArgs, {createFeatureSpell: APITypes.Mutation['createFeatureSpell']}>;

export const updateFeatureSpell = /* GraphQL */ `
mutation UpdateFeatureSpell($input: FeatureSpellInput!) {
  updateFeatureSpell(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureSpellArgs, {updateFeatureSpell: APITypes.Mutation['updateFeatureSpell']}>;

export const deleteFeatureSpell = /* GraphQL */ `
mutation DeleteFeatureSpell($id: ID!) {
  deleteFeatureSpell(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureSpellArgs, {deleteFeatureSpell: APITypes.Mutation['deleteFeatureSpell']}>;

export const batchCreateFeatureSpells = /* GraphQL */ `
mutation BatchCreateFeatureSpells($input: BatchFeatureSpellsInput!) {
  batchCreateFeatureSpells(input: $input) {
	__typename
	id
	ids
	attributes
	selectionCount
	classLimit
	levelLimit
	attributeLimit
	ability
	spellLevel
	spellsByLevel {
		__typename
		id
		ids
		level
		spellLevel
	}
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureSpellsArgs, {batchCreateFeatureSpells: APITypes.Mutation['batchCreateFeatureSpells']}>;

export const createMasterFeatureSense = /* GraphQL */ `
mutation CreateMasterFeatureSense($input: FeatureSenseInput!) {
  createMasterFeatureSense(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureSenseArgs, {createMasterFeatureSense: APITypes.Mutation['createMasterFeatureSense']}>;

export const updateMasterFeatureSense = /* GraphQL */ `
mutation UpdateMasterFeatureSense($input: FeatureSenseInput!) {
  updateMasterFeatureSense(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureSenseArgs, {updateMasterFeatureSense: APITypes.Mutation['updateMasterFeatureSense']}>;

export const deleteMasterFeatureSense = /* GraphQL */ `
mutation DeleteMasterFeatureSense($id: ID!) {
  deleteMasterFeatureSense(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureSenseArgs, {deleteMasterFeatureSense: APITypes.Mutation['deleteMasterFeatureSense']}>;

export const batchCreateMasterFeatureSenses = /* GraphQL */ `
mutation BatchCreateMasterFeatureSenses($input: BatchFeatureSensesInput!) {
  batchCreateMasterFeatureSenses(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureSensesArgs, {batchCreateMasterFeatureSenses: APITypes.Mutation['batchCreateMasterFeatureSenses']}>;

export const createFeatureSense = /* GraphQL */ `
mutation CreateFeatureSense($input: FeatureSenseInput!) {
  createFeatureSense(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureSenseArgs, {createFeatureSense: APITypes.Mutation['createFeatureSense']}>;

export const updateFeatureSense = /* GraphQL */ `
mutation UpdateFeatureSense($input: FeatureSenseInput!) {
  updateFeatureSense(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureSenseArgs, {updateFeatureSense: APITypes.Mutation['updateFeatureSense']}>;

export const deleteFeatureSense = /* GraphQL */ `
mutation DeleteFeatureSense($id: ID!) {
  deleteFeatureSense(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureSenseArgs, {deleteFeatureSense: APITypes.Mutation['deleteFeatureSense']}>;

export const batchCreateFeatureSenses = /* GraphQL */ `
mutation BatchCreateFeatureSenses($input: BatchFeatureSensesInput!) {
  batchCreateFeatureSenses(input: $input) {
	__typename
	id
	attributes
	selectionCount
	subtype
	ids
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureSensesArgs, {batchCreateFeatureSenses: APITypes.Mutation['batchCreateFeatureSenses']}>;

export const createMasterFeatureProficiency = /* GraphQL */ `
mutation CreateMasterFeatureProficiency($input: FeatureProficiencyInput!) {
  createMasterFeatureProficiency(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureProficiencyArgs, {createMasterFeatureProficiency: APITypes.Mutation['createMasterFeatureProficiency']}>;

export const updateMasterFeatureProficiency = /* GraphQL */ `
mutation UpdateMasterFeatureProficiency($input: FeatureProficiencyInput!) {
  updateMasterFeatureProficiency(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureProficiencyArgs, {updateMasterFeatureProficiency: APITypes.Mutation['updateMasterFeatureProficiency']}>;

export const deleteMasterFeatureProficiency = /* GraphQL */ `
mutation DeleteMasterFeatureProficiency($id: ID!) {
  deleteMasterFeatureProficiency(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureProficiencyArgs, {deleteMasterFeatureProficiency: APITypes.Mutation['deleteMasterFeatureProficiency']}>;

export const batchCreateMasterFeatureProficiencies = /* GraphQL */ `
mutation BatchCreateMasterFeatureProficiencies($input: BatchFeatureProficienciesInput!) {
  batchCreateMasterFeatureProficiencies(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureProficienciesArgs, {batchCreateMasterFeatureProficiencies: APITypes.Mutation['batchCreateMasterFeatureProficiencies']}>;

export const createFeatureProficiency = /* GraphQL */ `
mutation CreateFeatureProficiency($input: FeatureProficiencyInput!) {
  createFeatureProficiency(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureProficiencyArgs, {createFeatureProficiency: APITypes.Mutation['createFeatureProficiency']}>;

export const updateFeatureProficiency = /* GraphQL */ `
mutation UpdateFeatureProficiency($input: FeatureProficiencyInput!) {
  updateFeatureProficiency(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureProficiencyArgs, {updateFeatureProficiency: APITypes.Mutation['updateFeatureProficiency']}>;

export const deleteFeatureProficiency = /* GraphQL */ `
mutation DeleteFeatureProficiency($id: ID!) {
  deleteFeatureProficiency(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureProficiencyArgs, {deleteFeatureProficiency: APITypes.Mutation['deleteFeatureProficiency']}>;

export const batchCreateFeatureProficiencies = /* GraphQL */ `
mutation BatchCreateFeatureProficiencies($input: BatchFeatureProficienciesInput!) {
  batchCreateFeatureProficiencies(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	level
	rounding
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureProficienciesArgs, {batchCreateFeatureProficiencies: APITypes.Mutation['batchCreateFeatureProficiencies']}>;

export const createMasterFeatureOption = /* GraphQL */ `
mutation CreateMasterFeatureOption($input: FeatureOptionInput!) {
  createMasterFeatureOption(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureOptionArgs, {createMasterFeatureOption: APITypes.Mutation['createMasterFeatureOption']}>;

export const updateMasterFeatureOption = /* GraphQL */ `
mutation UpdateMasterFeatureOption($input: FeatureOptionInput!) {
  updateMasterFeatureOption(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureOptionArgs, {updateMasterFeatureOption: APITypes.Mutation['updateMasterFeatureOption']}>;

export const deleteMasterFeatureOption = /* GraphQL */ `
mutation DeleteMasterFeatureOption($id: ID!) {
  deleteMasterFeatureOption(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureOptionArgs, {deleteMasterFeatureOption: APITypes.Mutation['deleteMasterFeatureOption']}>;

export const batchCreateMasterFeatureOptions = /* GraphQL */ `
mutation BatchCreateMasterFeatureOptions($input: BatchFeatureOptionsInput!) {
  batchCreateMasterFeatureOptions(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureOptionsArgs, {batchCreateMasterFeatureOptions: APITypes.Mutation['batchCreateMasterFeatureOptions']}>;

export const createFeatureOption = /* GraphQL */ `
mutation CreateFeatureOption($input: FeatureOptionInput!) {
  createFeatureOption(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureOptionArgs, {createFeatureOption: APITypes.Mutation['createFeatureOption']}>;

export const updateFeatureOption = /* GraphQL */ `
mutation UpdateFeatureOption($input: FeatureOptionInput!) {
  updateFeatureOption(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureOptionArgs, {updateFeatureOption: APITypes.Mutation['updateFeatureOption']}>;

export const deleteFeatureOption = /* GraphQL */ `
mutation DeleteFeatureOption($id: ID!) {
  deleteFeatureOption(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureOptionArgs, {deleteFeatureOption: APITypes.Mutation['deleteFeatureOption']}>;

export const batchCreateFeatureOptions = /* GraphQL */ `
mutation BatchCreateFeatureOptions($input: BatchFeatureOptionsInput!) {
  batchCreateFeatureOptions(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureOptionsArgs, {batchCreateFeatureOptions: APITypes.Mutation['batchCreateFeatureOptions']}>;

export const createMasterFeatureModifier = /* GraphQL */ `
mutation CreateMasterFeatureModifier($input: FeatureModifierInput!) {
  createMasterFeatureModifier(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureModifierArgs, {createMasterFeatureModifier: APITypes.Mutation['createMasterFeatureModifier']}>;

export const updateMasterFeatureModifier = /* GraphQL */ `
mutation UpdateMasterFeatureModifier($input: FeatureModifierInput!) {
  updateMasterFeatureModifier(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureModifierArgs, {updateMasterFeatureModifier: APITypes.Mutation['updateMasterFeatureModifier']}>;

export const deleteMasterFeatureModifier = /* GraphQL */ `
mutation DeleteMasterFeatureModifier($id: ID!) {
  deleteMasterFeatureModifier(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureModifierArgs, {deleteMasterFeatureModifier: APITypes.Mutation['deleteMasterFeatureModifier']}>;

export const batchCreateMasterFeatureModifiers = /* GraphQL */ `
mutation BatchCreateMasterFeatureModifiers($input: BatchFeatureModifiersInput!) {
  batchCreateMasterFeatureModifiers(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureModifiersArgs, {batchCreateMasterFeatureModifiers: APITypes.Mutation['batchCreateMasterFeatureModifiers']}>;

export const createFeatureModifier = /* GraphQL */ `
mutation CreateFeatureModifier($input: FeatureModifierInput!) {
  createFeatureModifier(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureModifierArgs, {createFeatureModifier: APITypes.Mutation['createFeatureModifier']}>;

export const updateFeatureModifier = /* GraphQL */ `
mutation UpdateFeatureModifier($input: FeatureModifierInput!) {
  updateFeatureModifier(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureModifierArgs, {updateFeatureModifier: APITypes.Mutation['updateFeatureModifier']}>;

export const deleteFeatureModifier = /* GraphQL */ `
mutation DeleteFeatureModifier($id: ID!) {
  deleteFeatureModifier(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureModifierArgs, {deleteFeatureModifier: APITypes.Mutation['deleteFeatureModifier']}>;

export const batchCreateFeatureModifiers = /* GraphQL */ `
mutation BatchCreateFeatureModifiers($input: BatchFeatureModifiersInput!) {
  batchCreateFeatureModifiers(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	type
	method
	methodAbility
	methodSkill
	multiplier
	maxAmount
	minAmount
	setAmount
	dieConfig
	feature
	diePerLevel {
		__typename
		level
		dieConfig
	}
	setPerLevel {
		__typename
		level
		setAmount
	}
	skills
	saveAbilities
	abilities
	speeds
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range
	minRange
	maxRange
	shape
	size
	duration
	unit
	conditions
	damageTypes
	damageType
	spell
	spellCategory
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureModifiersArgs, {batchCreateFeatureModifiers: APITypes.Mutation['batchCreateFeatureModifiers']}>;

export const createMasterFeatureFeat = /* GraphQL */ `
mutation CreateMasterFeatureFeat($input: FeatureFeatInput!) {
  createMasterFeatureFeat(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureFeatArgs, {createMasterFeatureFeat: APITypes.Mutation['createMasterFeatureFeat']}>;

export const updateMasterFeatureFeat = /* GraphQL */ `
mutation UpdateMasterFeatureFeat($input: FeatureFeatInput!) {
  updateMasterFeatureFeat(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureFeatArgs, {updateMasterFeatureFeat: APITypes.Mutation['updateMasterFeatureFeat']}>;

export const deleteMasterFeatureFeat = /* GraphQL */ `
mutation DeleteMasterFeatureFeat($id: ID!) {
  deleteMasterFeatureFeat(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureFeatArgs, {deleteMasterFeatureFeat: APITypes.Mutation['deleteMasterFeatureFeat']}>;

export const batchCreateMasterFeatureFeats = /* GraphQL */ `
mutation BatchCreateMasterFeatureFeats($input: BatchFeatureFeatsInput!) {
  batchCreateMasterFeatureFeats(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureFeatsArgs, {batchCreateMasterFeatureFeats: APITypes.Mutation['batchCreateMasterFeatureFeats']}>;

export const createFeatureFeat = /* GraphQL */ `
mutation CreateFeatureFeat($input: FeatureFeatInput!) {
  createFeatureFeat(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureFeatArgs, {createFeatureFeat: APITypes.Mutation['createFeatureFeat']}>;

export const updateFeatureFeat = /* GraphQL */ `
mutation UpdateFeatureFeat($input: FeatureFeatInput!) {
  updateFeatureFeat(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureFeatArgs, {updateFeatureFeat: APITypes.Mutation['updateFeatureFeat']}>;

export const deleteFeatureFeat = /* GraphQL */ `
mutation DeleteFeatureFeat($id: ID!) {
  deleteFeatureFeat(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureFeatArgs, {deleteFeatureFeat: APITypes.Mutation['deleteFeatureFeat']}>;

export const batchCreateFeatureFeats = /* GraphQL */ `
mutation BatchCreateFeatureFeats($input: BatchFeatureFeatsInput!) {
  batchCreateFeatureFeats(input: $input) {
	__typename
	id
	attributes
	feats
	selectionCount
	subtype
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureFeatsArgs, {batchCreateFeatureFeats: APITypes.Mutation['batchCreateFeatureFeats']}>;

export const createMasterFeatureExpertise = /* GraphQL */ `
mutation CreateMasterFeatureExpertise($input: FeatureExpertiseInput!) {
  createMasterFeatureExpertise(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureExpertiseArgs, {createMasterFeatureExpertise: APITypes.Mutation['createMasterFeatureExpertise']}>;

export const updateMasterFeatureExpertise = /* GraphQL */ `
mutation UpdateMasterFeatureExpertise($input: FeatureExpertiseInput!) {
  updateMasterFeatureExpertise(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureExpertiseArgs, {updateMasterFeatureExpertise: APITypes.Mutation['updateMasterFeatureExpertise']}>;

export const deleteMasterFeatureExpertise = /* GraphQL */ `
mutation DeleteMasterFeatureExpertise($id: ID!) {
  deleteMasterFeatureExpertise(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureExpertiseArgs, {deleteMasterFeatureExpertise: APITypes.Mutation['deleteMasterFeatureExpertise']}>;

export const batchCreateMasterFeatureExpertises = /* GraphQL */ `
mutation BatchCreateMasterFeatureExpertises($input: BatchFeatureExpertisesInput!) {
  batchCreateMasterFeatureExpertises(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatureExpertisesArgs, {batchCreateMasterFeatureExpertises: APITypes.Mutation['batchCreateMasterFeatureExpertises']}>;

export const createFeatureExpertise = /* GraphQL */ `
mutation CreateFeatureExpertise($input: FeatureExpertiseInput!) {
  createFeatureExpertise(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureExpertiseArgs, {createFeatureExpertise: APITypes.Mutation['createFeatureExpertise']}>;

export const updateFeatureExpertise = /* GraphQL */ `
mutation UpdateFeatureExpertise($input: FeatureExpertiseInput!) {
  updateFeatureExpertise(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureExpertiseArgs, {updateFeatureExpertise: APITypes.Mutation['updateFeatureExpertise']}>;

export const deleteFeatureExpertise = /* GraphQL */ `
mutation DeleteFeatureExpertise($id: ID!) {
  deleteFeatureExpertise(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureExpertiseArgs, {deleteFeatureExpertise: APITypes.Mutation['deleteFeatureExpertise']}>;

export const batchCreateFeatureExpertises = /* GraphQL */ `
mutation BatchCreateFeatureExpertises($input: BatchFeatureExpertisesInput!) {
  batchCreateFeatureExpertises(input: $input) {
	__typename
	id
	subtype
	attributes
	selectionCount
	category
	saveAbilities
	skills
	languages
	properties {
		__typename
		ids
		category
		properties
	}
	equipment {
		__typename
		ids
		category
		properties
	}
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatureExpertisesArgs, {batchCreateFeatureExpertises: APITypes.Mutation['batchCreateFeatureExpertises']}>;

export const createMasterFeature = /* GraphQL */ `
mutation CreateMasterFeature($input: FeatureInput!) {
  createMasterFeature(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatureArgs, {createMasterFeature: APITypes.Mutation['createMasterFeature']}>;

export const updateMasterFeature = /* GraphQL */ `
mutation UpdateMasterFeature($input: FeatureInput!) {
  updateMasterFeature(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatureArgs, {updateMasterFeature: APITypes.Mutation['updateMasterFeature']}>;

export const deleteMasterFeature = /* GraphQL */ `
mutation DeleteMasterFeature($id: ID!) {
  deleteMasterFeature(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatureArgs, {deleteMasterFeature: APITypes.Mutation['deleteMasterFeature']}>;

export const batchCreateMasterFeatures = /* GraphQL */ `
mutation BatchCreateMasterFeatures($input: BatchFeaturesInput!) {
  batchCreateMasterFeatures(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeaturesArgs, {batchCreateMasterFeatures: APITypes.Mutation['batchCreateMasterFeatures']}>;

export const createFeature = /* GraphQL */ `
mutation CreateFeature($input: FeatureInput!) {
  createFeature(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatureArgs, {createFeature: APITypes.Mutation['createFeature']}>;

export const updateFeature = /* GraphQL */ `
mutation UpdateFeature($input: FeatureInput!) {
  updateFeature(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatureArgs, {updateFeature: APITypes.Mutation['updateFeature']}>;

export const deleteFeature = /* GraphQL */ `
mutation DeleteFeature($id: ID!) {
  deleteFeature(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatureArgs, {deleteFeature: APITypes.Mutation['deleteFeature']}>;

export const batchCreateFeatures = /* GraphQL */ `
mutation BatchCreateFeatures($input: BatchFeaturesInput!) {
  batchCreateFeatures(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	optionsByLevel {
		__typename
		level
		count
		replaceCount
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	feats
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	levelAvailable
	options
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeaturesArgs, {batchCreateFeatures: APITypes.Mutation['batchCreateFeatures']}>;

export const createMasterFeat = /* GraphQL */ `
mutation CreateMasterFeat($input: FeatInput!) {
  createMasterFeat(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterFeatArgs, {createMasterFeat: APITypes.Mutation['createMasterFeat']}>;

export const updateMasterFeat = /* GraphQL */ `
mutation UpdateMasterFeat($input: FeatInput!) {
  updateMasterFeat(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterFeatArgs, {updateMasterFeat: APITypes.Mutation['updateMasterFeat']}>;

export const deleteMasterFeat = /* GraphQL */ `
mutation DeleteMasterFeat($id: ID!) {
  deleteMasterFeat(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterFeatArgs, {deleteMasterFeat: APITypes.Mutation['deleteMasterFeat']}>;

export const batchCreateMasterFeats = /* GraphQL */ `
mutation BatchCreateMasterFeats($input: BatchFeatInput!) {
  batchCreateMasterFeats(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterFeatsArgs, {batchCreateMasterFeats: APITypes.Mutation['batchCreateMasterFeats']}>;

export const createFeat = /* GraphQL */ `
mutation CreateFeat($input: FeatInput!) {
  createFeat(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateFeatArgs, {createFeat: APITypes.Mutation['createFeat']}>;

export const updateFeat = /* GraphQL */ `
mutation UpdateFeat($input: FeatInput!) {
  updateFeat(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateFeatArgs, {updateFeat: APITypes.Mutation['updateFeat']}>;

export const deleteFeat = /* GraphQL */ `
mutation DeleteFeat($id: ID!) {
  deleteFeat(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteFeatArgs, {deleteFeat: APITypes.Mutation['deleteFeat']}>;

export const batchCreateFeats = /* GraphQL */ `
mutation BatchCreateFeats($input: BatchFeatInput!) {
  batchCreateFeats(input: $input) {
	__typename
	id
	label
	desc
	detail
	category
	attributes
	actions {
		__typename
		primary {
			__typename
			id
			amount
		}
		secondary {
			__typename
			id
			amount
		}
	}
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	charges {
		__typename
		reset
		limit
		ability
		skill
		usesPerLevel {
			__typename
			level
			uses
		}
		minAmount
		addAmount
		setAmount
		multiplier
		resourcePoints
	}
	range {
		__typename
		id
		minRange
		maxRange
		distance
		unit
	}
	shape {
		__typename
		id
		size
		unit
	}
	targets
	modifiers
	proficiencies
	expertise
	senses
	spells
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	selectionCount
	levelAvailable
	features
	options
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatsArgs, {batchCreateFeats: APITypes.Mutation['batchCreateFeats']}>;

export const createMasterEquipment = /* GraphQL */ `
mutation CreateMasterEquipment($input: EquipmentInput!) {
  createMasterEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterEquipmentArgs, {createMasterEquipment: APITypes.Mutation['createMasterEquipment']}>;

export const updateMasterEquipment = /* GraphQL */ `
mutation UpdateMasterEquipment($input: EquipmentInput!) {
  updateMasterEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterEquipmentArgs, {updateMasterEquipment: APITypes.Mutation['updateMasterEquipment']}>;

export const deleteMasterEquipment = /* GraphQL */ `
mutation DeleteMasterEquipment($id: ID!) {
  deleteMasterEquipment(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterEquipmentArgs, {deleteMasterEquipment: APITypes.Mutation['deleteMasterEquipment']}>;

export const batchCreateMasterEquipment = /* GraphQL */ `
mutation BatchCreateMasterEquipment($input: BatchEquipmentInput!) {
  batchCreateMasterEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterEquipmentArgs, {batchCreateMasterEquipment: APITypes.Mutation['batchCreateMasterEquipment']}>;

export const createEquipment = /* GraphQL */ `
mutation CreateEquipment($input: EquipmentInput!) {
  createEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationCreateEquipmentArgs, {createEquipment: APITypes.Mutation['createEquipment']}>;

export const updateEquipment = /* GraphQL */ `
mutation UpdateEquipment($input: EquipmentInput!) {
  updateEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationUpdateEquipmentArgs, {updateEquipment: APITypes.Mutation['updateEquipment']}>;

export const deleteEquipment = /* GraphQL */ `
mutation DeleteEquipment($id: ID!) {
  deleteEquipment(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteEquipmentArgs, {deleteEquipment: APITypes.Mutation['deleteEquipment']}>;

export const batchCreateEquipment = /* GraphQL */ `
mutation BatchCreateEquipment($input: BatchEquipmentInput!) {
  batchCreateEquipment(input: $input) {
	__typename
	id
	label
	desc
	quote
	cost {
		__typename
		amount
		currency
	}
	weight {
		__typename
		amount
		unit
	}
	capacity {
		__typename
		amount
		unit
	}
	maxStack
	quantity
	properties
	category
	rarity
	attributes
	damage {
		__typename
		attributes
		damageSave
		setPerLevel {
			__typename
			level
			primary
			secondary
			bonus
		}
		diePerLevel {
			__typename
			level
			primary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			secondary {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
			bonus {
				__typename
				dieConfig
				attribute
				id
				ability
				setAmount
				multiplier
				minAmount
				maxAmount
				pool {
					__typename
					attribute
					setAmount
					multiplier
					minAmount
					maxAmount
					ability
					option
				}
			}
		}
		primary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		secondary {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		bonus {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
		versatile {
			__typename
			dieConfig
			attribute
			id
			ability
			setAmount
			multiplier
			minAmount
			maxAmount
			pool {
				__typename
				attribute
				setAmount
				multiplier
				minAmount
				maxAmount
				ability
				option
			}
		}
	}
	saveAbility {
		__typename
		id
		minAmount
		attributes
		abilityModifier
	}
	primaryAbility
	secondaryAbility
	optionalAbility
	maxBonus
	armorClass
	prerequisities {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
			__typename
			abilities
			score
		}
		spellsObtained
		featuresObtained
		optionsObtained
		size
	}
	speed {
		__typename
		amount
		unit
	}
	range {
		__typename
		minRange
		maxRange
		unit
	}
	contains {
		__typename
		id
		quantity
	}
	features
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateEquipmentArgs, {batchCreateEquipment: APITypes.Mutation['batchCreateEquipment']}>;

export const createMasterClass = /* GraphQL */ `
mutation CreateMasterClass($input: ClassInput!) {
  createMasterClass(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterClassArgs, {createMasterClass: APITypes.Mutation['createMasterClass']}>;

export const updateMasterClass = /* GraphQL */ `
mutation UpdateMasterClass($input: ClassInput!) {
  updateMasterClass(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterClassArgs, {updateMasterClass: APITypes.Mutation['updateMasterClass']}>;

export const deleteMasterClass = /* GraphQL */ `
mutation DeleteMasterClass($id: ID!) {
  deleteMasterClass(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterClassArgs, {deleteMasterClass: APITypes.Mutation['deleteMasterClass']}>;

export const batchCreateMasterClasses = /* GraphQL */ `
mutation BatchCreateMasterClasses($input: BatchClassesInput!) {
  batchCreateMasterClasses(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterClassesArgs, {batchCreateMasterClasses: APITypes.Mutation['batchCreateMasterClasses']}>;

export const createClass = /* GraphQL */ `
mutation CreateClass($input: ClassInput!) {
  createClass(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateClassArgs, {createClass: APITypes.Mutation['createClass']}>;

export const updateClass = /* GraphQL */ `
mutation UpdateClass($input: ClassInput!) {
  updateClass(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateClassArgs, {updateClass: APITypes.Mutation['updateClass']}>;

export const deleteClass = /* GraphQL */ `
mutation DeleteClass($id: ID!) {
  deleteClass(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteClassArgs, {deleteClass: APITypes.Mutation['deleteClass']}>;

export const batchCreateClasses = /* GraphQL */ `
mutation BatchCreateClasses($input: BatchClassesInput!) {
  batchCreateClasses(input: $input) {
	__typename
	id
	label
	desc
	attributes
	category
	details {
		__typename
		label
		desc
	}
	hitpoint {
		__typename
		ability
		dieConfig
	}
	startingGold {
		__typename
		multiplier
		currency
		dieConfig
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	spellcasting {
		__typename
		magicName
		ability
		maxSpellLevel
		attributes
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		prepareLimit {
			__typename
			methods
			level {
				__typename
				measurement
				rounding
			}
		}
	}
	levelAttributes {
		__typename
		level
		spellSlots {
			__typename
			slotCount
		}
		resourcePoints
		spellsKnownLimit
		cantripsKnownLimit
	}
	resource {
		__typename
		label
		id
		levelAvailable
		charges {
			__typename
			reset
			limit
			ability
			skill
			usesPerLevel {
				__typename
				level
				uses
			}
			minAmount
			addAmount
			setAmount
			multiplier
			resourcePoints
		}
		method
		desc
	}
	multiclass {
		__typename
		primaryAbility {
			__typename
			id
			minAmount
		}
		secondaryAbility {
			__typename
			id
			minAmount
		}
		optionalAbility {
			__typename
			id
			minAmount
		}
	}
	parentClass
	subtypes {
		__typename
		id
		label
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateClassesArgs, {batchCreateClasses: APITypes.Mutation['batchCreateClasses']}>;

export const createCharacter = /* GraphQL */ `
mutation CreateCharacter($input: CharacterInput!) {
  createCharacter(input: $input) {
	__typename
	id
	label
	desc
	advancement
	exp
	hitpoint {
		__typename
		method
		maxOverride
		maxHitpoints
		temp
		bonus
		rolled {
			__typename
			values {
				__typename
				level
				value
			}
			total
			current
		}
		fixed {
			__typename
			current
			total
		}
	}
	abilities {
		__typename
		manualRolled {
			__typename
			configuration
			rollGroups {
				__typename
				score
				ability
				rolling
				applied
				rolled {
					__typename
					die
					value
					id
				}
				kept {
					__typename
					die
					value
					id
				}
			}
			manual {
				__typename
				ability
				score
			}
		}
		pointBuy {
			__typename
			pointsLeft
			distributed {
				__typename
				ability
				id
			}
		}
		standardArray {
			__typename
			ability
			score
		}
		selectedSystem
		scores {
			__typename
			ability
			baseScore
			raceScore
			classScore
			calculatedScore
			modifierScore
		}
	}
	race
	ancestry {
		__typename
		id
		raceId
		lineages
	}
	background
	classes {
		__typename
		id
		subclass {
			__typename
			id
			subtype
		}
		level
	}
	spellcasting {
		__typename
		prepared {
			__typename
			level
			spells {
				__typename
				id
				classId
				ability
				isRitual
				countAsKnown
				usesSlot
				alwaysPrepared
				castAtLevel
				requiresConcentration
				optionalAbility
			}
		}
		known {
			__typename
			level
			spells {
				__typename
				id
				classId
				ability
				isRitual
				countAsKnown
				usesSlot
				alwaysPrepared
				castAtLevel
				requiresConcentration
				optionalAbility
			}
		}
		additional {
			__typename
			id
			level
			saveAbility
			isRitual
			countAsKnown
			usesSlot
			alwaysPrepared
			castAtLevel
			requiresConcentration
			optionalAbility
			featureId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
			featureLevel
		}
		spellSlots {
			__typename
			level
			used
			classId
		}
	}
	classEquipment {
		__typename
		option
		goldOption
		totalGold
		equipmentGroups {
			__typename
			optionId
			groupId
			equipment {
				__typename
				id
				selectionId
				quantity
			}
		}
		addedToCharacter
	}
	backgroundEquipment {
		__typename
		equipmentGroups {
			__typename
			optionId
			groupId
			equipment {
				__typename
				id
				selectionId
				quantity
			}
		}
		addedToCharacter
	}
	equipment {
		__typename
		equipped
		attuned
		inventory {
			__typename
			id
			equipmentId
			quantity
			containerId
			containerPath
			customName
			notes
		}
	}
	currencyGroups {
		__typename
		currencies {
			__typename
			id
			amount
		}
		container
	}
	features {
		__typename
		id
		options {
			__typename
			id
			optionIndex
			featureLevel
		}
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		level
	}
	feats {
		__typename
		id
		featId
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		optionId
		optionIndex
		featureLevel
	}
	proficiencies {
		__typename
		skill
		language
		saveAbility
		property
		equipment
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	expertise {
		__typename
		skill
		language
		saveAbility
		property
		equipment
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	modifiers {
		__typename
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	senses {
		__typename
		id
		senseId
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	ownerId
	systemId
  }
}
`as GeneratedMutation<APITypes.MutationCreateCharacterArgs, {createCharacter: APITypes.Mutation['createCharacter']}>;

export const updateCharacter = /* GraphQL */ `
mutation UpdateCharacter($input: CharacterInput!) {
  updateCharacter(input: $input) {
	__typename
	id
	label
	desc
	advancement
	exp
	hitpoint {
		__typename
		method
		maxOverride
		maxHitpoints
		temp
		bonus
		rolled {
			__typename
			values {
				__typename
				level
				value
			}
			total
			current
		}
		fixed {
			__typename
			current
			total
		}
	}
	abilities {
		__typename
		manualRolled {
			__typename
			configuration
			rollGroups {
				__typename
				score
				ability
				rolling
				applied
				rolled {
					__typename
					die
					value
					id
				}
				kept {
					__typename
					die
					value
					id
				}
			}
			manual {
				__typename
				ability
				score
			}
		}
		pointBuy {
			__typename
			pointsLeft
			distributed {
				__typename
				ability
				id
			}
		}
		standardArray {
			__typename
			ability
			score
		}
		selectedSystem
		scores {
			__typename
			ability
			baseScore
			raceScore
			classScore
			calculatedScore
			modifierScore
		}
	}
	race
	ancestry {
		__typename
		id
		raceId
		lineages
	}
	background
	classes {
		__typename
		id
		subclass {
			__typename
			id
			subtype
		}
		level
	}
	spellcasting {
		__typename
		prepared {
			__typename
			level
			spells {
				__typename
				id
				classId
				ability
				isRitual
				countAsKnown
				usesSlot
				alwaysPrepared
				castAtLevel
				requiresConcentration
				optionalAbility
			}
		}
		known {
			__typename
			level
			spells {
				__typename
				id
				classId
				ability
				isRitual
				countAsKnown
				usesSlot
				alwaysPrepared
				castAtLevel
				requiresConcentration
				optionalAbility
			}
		}
		additional {
			__typename
			id
			level
			saveAbility
			isRitual
			countAsKnown
			usesSlot
			alwaysPrepared
			castAtLevel
			requiresConcentration
			optionalAbility
			featureId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
			featureLevel
		}
		spellSlots {
			__typename
			level
			used
			classId
		}
	}
	classEquipment {
		__typename
		option
		goldOption
		totalGold
		equipmentGroups {
			__typename
			optionId
			groupId
			equipment {
				__typename
				id
				selectionId
				quantity
			}
		}
		addedToCharacter
	}
	backgroundEquipment {
		__typename
		equipmentGroups {
			__typename
			optionId
			groupId
			equipment {
				__typename
				id
				selectionId
				quantity
			}
		}
		addedToCharacter
	}
	equipment {
		__typename
		equipped
		attuned
		inventory {
			__typename
			id
			equipmentId
			quantity
			containerId
			containerPath
			customName
			notes
		}
	}
	currencyGroups {
		__typename
		currencies {
			__typename
			id
			amount
		}
		container
	}
	features {
		__typename
		id
		options {
			__typename
			id
			optionIndex
			featureLevel
		}
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		level
	}
	feats {
		__typename
		id
		featId
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		optionId
		optionIndex
		featureLevel
	}
	proficiencies {
		__typename
		skill
		language
		saveAbility
		property
		equipment
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	expertise {
		__typename
		skill
		language
		saveAbility
		property
		equipment
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	modifiers {
		__typename
		id
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	senses {
		__typename
		id
		senseId
		featureId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
		featureLevel
	}
	ownerId
	systemId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateCharacterArgs, {updateCharacter: APITypes.Mutation['updateCharacter']}>;

export const deleteCharacter = /* GraphQL */ `
mutation DeleteCharacter($id: ID!) {
  deleteCharacter(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteCharacterArgs, {deleteCharacter: APITypes.Mutation['deleteCharacter']}>;

export const createMasterBackground = /* GraphQL */ `
mutation CreateMasterBackground($input: BackgroundInput!) {
  createMasterBackground(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterBackgroundArgs, {createMasterBackground: APITypes.Mutation['createMasterBackground']}>;

export const updateMasterBackground = /* GraphQL */ `
mutation UpdateMasterBackground($input: BackgroundInput!) {
  updateMasterBackground(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterBackgroundArgs, {updateMasterBackground: APITypes.Mutation['updateMasterBackground']}>;

export const deleteMasterBackground = /* GraphQL */ `
mutation DeleteMasterBackground($id: ID!) {
  deleteMasterBackground(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterBackgroundArgs, {deleteMasterBackground: APITypes.Mutation['deleteMasterBackground']}>;

export const batchCreateMasterBackgrounds = /* GraphQL */ `
mutation BatchCreateMasterBackgrounds($input: BatchBackgroundsInput!) {
  batchCreateMasterBackgrounds(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterBackgroundsArgs, {batchCreateMasterBackgrounds: APITypes.Mutation['batchCreateMasterBackgrounds']}>;

export const createBackground = /* GraphQL */ `
mutation CreateBackground($input: BackgroundInput!) {
  createBackground(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationCreateBackgroundArgs, {createBackground: APITypes.Mutation['createBackground']}>;

export const updateBackground = /* GraphQL */ `
mutation UpdateBackground($input: BackgroundInput!) {
  updateBackground(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationUpdateBackgroundArgs, {updateBackground: APITypes.Mutation['updateBackground']}>;

export const deleteBackground = /* GraphQL */ `
mutation DeleteBackground($id: ID!) {
  deleteBackground(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteBackgroundArgs, {deleteBackground: APITypes.Mutation['deleteBackground']}>;

export const batchCreateBackgrounds = /* GraphQL */ `
mutation BatchCreateBackgrounds($input: BatchBackgroundsInput!) {
  batchCreateBackgrounds(input: $input) {
	__typename
	id
	label
	desc
	details {
		__typename
		label
		desc
	}
	equipment {
		__typename
		attributes
		selectionCount
		category
		equipment
		properties
		quantity
		currencies {
			__typename
			id
			amount
		}
	}
	proficiencies {
		__typename
		id
		subtype
		attributes
		selectionCount
		category
		level
		rounding
		saveAbilities
		skills
		languages
		properties {
			__typename
			ids
			category
			properties
		}
		equipment {
			__typename
			ids
			category
			properties
		}
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
				__typename
				abilities
				score
			}
			spellsObtained
			featuresObtained
			optionsObtained
			size
		}
	}
	features
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateBackgroundsArgs, {batchCreateBackgrounds: APITypes.Mutation['batchCreateBackgrounds']}>;

export const createMasterAncestryOption = /* GraphQL */ `
mutation CreateMasterAncestryOption($input: AncestryOptionInput!) {
  createMasterAncestryOption(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationCreateMasterAncestryOptionArgs, {createMasterAncestryOption: APITypes.Mutation['createMasterAncestryOption']}>;

export const updateMasterAncestryOption = /* GraphQL */ `
mutation UpdateMasterAncestryOption($input: AncestryOptionInput!) {
  updateMasterAncestryOption(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationUpdateMasterAncestryOptionArgs, {updateMasterAncestryOption: APITypes.Mutation['updateMasterAncestryOption']}>;

export const deleteMasterAncestryOption = /* GraphQL */ `
mutation DeleteMasterAncestryOption($id: ID!) {
  deleteMasterAncestryOption(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteMasterAncestryOptionArgs, {deleteMasterAncestryOption: APITypes.Mutation['deleteMasterAncestryOption']}>;

export const batchCreateMasterAncestryOptions = /* GraphQL */ `
mutation BatchCreateMasterAncestryOptions($input: BatchAncestryOptionsInput!) {
  batchCreateMasterAncestryOptions(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateMasterAncestryOptionsArgs, {batchCreateMasterAncestryOptions: APITypes.Mutation['batchCreateMasterAncestryOptions']}>;

export const createAncestryOption = /* GraphQL */ `
mutation CreateAncestryOption($input: AncestryOptionInput!) {
  createAncestryOption(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationCreateAncestryOptionArgs, {createAncestryOption: APITypes.Mutation['createAncestryOption']}>;

export const updateAncestryOption = /* GraphQL */ `
mutation UpdateAncestryOption($input: AncestryOptionInput!) {
  updateAncestryOption(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationUpdateAncestryOptionArgs, {updateAncestryOption: APITypes.Mutation['updateAncestryOption']}>;

export const deleteAncestryOption = /* GraphQL */ `
mutation DeleteAncestryOption($id: ID!) {
  deleteAncestryOption(id: $id) {
  }
}
`as GeneratedMutation<APITypes.MutationDeleteAncestryOptionArgs, {deleteAncestryOption: APITypes.Mutation['deleteAncestryOption']}>;

export const batchCreateAncestryOptions = /* GraphQL */ `
mutation BatchCreateAncestryOptions($input: BatchAncestryOptionsInput!) {
  batchCreateAncestryOptions(input: $input) {
	__typename
	id
	label
	desc
	features
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateAncestryOptionsArgs, {batchCreateAncestryOptions: APITypes.Mutation['batchCreateAncestryOptions']}>;

