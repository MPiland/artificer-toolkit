/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedMutation<InputType, OutputType> = string & {
    __generatedMutationInput: InputType;
    __generatedMutationOutput: OutputType;
  };

export const createSystem = /* GraphQL */ `
mutation CreateSystem($input: SystemInput!) {
  createSystem(input: $input) {
	__typename
	id
	value
	label
	desc
	abilities {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		value
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
		value
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			value
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
			value
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
			value
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
		value
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			value
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
			value
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			value
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
		value
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		value
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
			value
			label
			multiplier
		}
		categories {
			__typename
			id
			value
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
				value
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				value
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
					value
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					value
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					value
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
			value
			label
			total
			options {
				__typename
				id
				value
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		value
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		value
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		value
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
	value
	label
	desc
	abilities {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		value
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
		value
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			value
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
			value
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
			value
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
		value
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			value
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
			value
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			value
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
		value
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		value
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
			value
			label
			multiplier
		}
		categories {
			__typename
			id
			value
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
				value
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				value
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
					value
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					value
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					value
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
			value
			label
			total
			options {
				__typename
				id
				value
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		value
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		value
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		value
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
	value
	label
	desc
	abilities {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	actions {
		__typename
		id
		value
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
		value
		label
		desc
		tooltip
		short
	}
	attributes {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		advancementMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellPointCalcMethods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		startingEquipmentOptions {
			__typename
			id
			value
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
			value
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
			value
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
		value
		label
		desc
		tooltip
		short
	}
	currencies {
		__typename
		id
		value
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
		value
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
			value
			label
			desc
			tooltip
			short
		}
		properties {
			__typename
			id
			value
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
			value
			label
			desc
			tooltip
			short
		}
	}
	languages {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		types {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		methods {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		spellCategories {
			__typename
			id
			value
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
		value
		label
		desc
		tooltip
		short
	}
	prerequisites {
		__typename
		id
		value
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
			value
			label
			multiplier
		}
		categories {
			__typename
			id
			value
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
				value
				label
				desc
				tooltip
				short
			}
			rounding {
				__typename
				id
				value
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
					value
					label
					desc
					tooltip
					short
				}
				volume {
					__typename
					id
					value
					label
					desc
					tooltip
					short
				}
				length {
					__typename
					id
					value
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
			value
			label
			total
			options {
				__typename
				id
				value
				label
				reduce
			}
		}
	}
	senses {
		__typename
		id
		value
		label
		creatureDesc
		monsterDesc
		type
	}
	sizes {
		__typename
		id
		value
		label
		desc
		tooltip
		short
	}
	skills {
		__typename
		id
		value
		label
		desc
		abilityId
	}
	speeds {
		__typename
		id
		value
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
			value
			label
			desc
			tooltip
			short
		}
		durations {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		ranges {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		schools {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		shapes {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
		requirements {
			__typename
			id
			value
			label
			desc
			tooltip
			short
		}
	}
	terrains {
		__typename
		id
		value
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

export const createSpell = /* GraphQL */ `
mutation CreateSpell($input: SpellInput!) {
  createSpell(input: $input) {
	__typename
	id
	label
	value
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
	value
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
	value
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

export const createRace = /* GraphQL */ `
mutation CreateRace($input: RaceInput!) {
  createRace(input: $input) {
	__typename
	id
	label
	value
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		value
		desc
		options {
			__typename
			id
			value
			label
			desc
			features {
				__typename
				id
				label
				value
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
				feats {
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
				modifiers {
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
					charge {
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
				expertise {
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
				senses {
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
				spells {
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
						spells
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
				options {
					__typename
					id
					label
					value
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
					feats {
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
					modifiers {
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
						charge {
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
					expertise {
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
					senses {
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
					spells {
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
							spells
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
		}
	}
	details {
		__typename
		label
		value
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		value
		desc
		options {
			__typename
			id
			value
			label
			desc
			features {
				__typename
				id
				label
				value
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
				feats {
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
				modifiers {
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
					charge {
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
				expertise {
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
				senses {
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
				spells {
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
						spells
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
				options {
					__typename
					id
					label
					value
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
					feats {
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
					modifiers {
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
						charge {
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
					expertise {
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
					senses {
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
					spells {
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
							spells
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
		}
	}
	details {
		__typename
		label
		value
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	quote
	desc
	playable
	category
	lineages
	ancestry {
		__typename
		id
		label
		value
		desc
		options {
			__typename
			id
			value
			label
			desc
			features {
				__typename
				id
				label
				value
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
				feats {
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
				modifiers {
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
					charge {
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
				expertise {
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
				senses {
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
				spells {
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
						spells
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
				options {
					__typename
					id
					label
					value
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
					feats {
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
					modifiers {
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
						charge {
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
					expertise {
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
					senses {
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
					spells {
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
							spells
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
		}
	}
	details {
		__typename
		label
		value
		desc
	}
	traits {
		__typename
		details {
			__typename
			label
			value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateRacesArgs, {batchCreateRaces: APITypes.Mutation['batchCreateRaces']}>;

export const createFeat = /* GraphQL */ `
mutation CreateFeat($input: FeatInput!) {
  createFeat(input: $input) {
	__typename
	id
	label
	value
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
	primaryDamage {
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
	secondaryDamage {
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
	bonusDamage {
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
	feats {
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
	modifiers {
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
		charge {
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
	expertise {
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
	senses {
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
	spells {
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
			spells
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
	spellcasting {
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
			spells
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	options {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
	value
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
	primaryDamage {
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
	secondaryDamage {
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
	bonusDamage {
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
	feats {
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
	modifiers {
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
		charge {
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
	expertise {
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
	senses {
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
	spells {
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
			spells
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
	spellcasting {
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
			spells
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	options {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
	value
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
	primaryDamage {
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
	secondaryDamage {
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
	bonusDamage {
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
	feats {
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
	modifiers {
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
		charge {
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
	expertise {
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
	senses {
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
	spells {
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
			spells
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
	spellcasting {
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
			spells
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	options {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateFeatsArgs, {batchCreateFeats: APITypes.Mutation['batchCreateFeats']}>;

export const createEquipment = /* GraphQL */ `
mutation CreateEquipment($input: EquipmentInput!) {
  createEquipment(input: $input) {
	__typename
	id
	label
	value
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
	equipmentRank
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
		equipped
		attuned
		contains {
			__typename
			id
			quantity
			equipped
			attuned
			contains {
				__typename
				id
				quantity
				equipped
				attuned
				contains {
					__typename
					id
					quantity
					equipped
					attuned
					contains {
						__typename
						id
						quantity
						equipped
						attuned
						contains {
							__typename
							id
							quantity
							equipped
							attuned
							contains {
								__typename
								id
								quantity
								equipped
								attuned
								contains {
									__typename
									id
									quantity
									equipped
									attuned
									contains {
										__typename
										id
										quantity
										equipped
										attuned
										contains {
											__typename
											id
											quantity
											equipped
											attuned
											contains {
												__typename
												id
												quantity
												equipped
												attuned
												contains { __typename }
												possessions { __typename }
											}
											possessions {
												__typename
												id
												label
												value
												desc
											}
										}
										possessions {
											__typename
											id
											label
											value
											desc
										}
									}
									possessions {
										__typename
										id
										label
										value
										desc
									}
								}
								possessions {
									__typename
									id
									label
									value
									desc
								}
							}
							possessions {
								__typename
								id
								label
								value
								desc
							}
						}
						possessions {
							__typename
							id
							label
							value
							desc
						}
					}
					possessions {
						__typename
						id
						label
						value
						desc
					}
				}
				possessions {
					__typename
					id
					label
					value
					desc
				}
			}
			possessions {
				__typename
				id
				label
				value
				desc
			}
		}
		possessions {
			__typename
			id
			label
			value
			desc
		}
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
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
	equipmentRank
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
		equipped
		attuned
		contains {
			__typename
			id
			quantity
			equipped
			attuned
			contains {
				__typename
				id
				quantity
				equipped
				attuned
				contains {
					__typename
					id
					quantity
					equipped
					attuned
					contains {
						__typename
						id
						quantity
						equipped
						attuned
						contains {
							__typename
							id
							quantity
							equipped
							attuned
							contains {
								__typename
								id
								quantity
								equipped
								attuned
								contains {
									__typename
									id
									quantity
									equipped
									attuned
									contains {
										__typename
										id
										quantity
										equipped
										attuned
										contains {
											__typename
											id
											quantity
											equipped
											attuned
											contains {
												__typename
												id
												quantity
												equipped
												attuned
												contains { __typename }
												possessions { __typename }
											}
											possessions {
												__typename
												id
												label
												value
												desc
											}
										}
										possessions {
											__typename
											id
											label
											value
											desc
										}
									}
									possessions {
										__typename
										id
										label
										value
										desc
									}
								}
								possessions {
									__typename
									id
									label
									value
									desc
								}
							}
							possessions {
								__typename
								id
								label
								value
								desc
							}
						}
						possessions {
							__typename
							id
							label
							value
							desc
						}
					}
					possessions {
						__typename
						id
						label
						value
						desc
					}
				}
				possessions {
					__typename
					id
					label
					value
					desc
				}
			}
			possessions {
				__typename
				id
				label
				value
				desc
			}
		}
		possessions {
			__typename
			id
			label
			value
			desc
		}
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
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
	equipmentRank
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
		equipped
		attuned
		contains {
			__typename
			id
			quantity
			equipped
			attuned
			contains {
				__typename
				id
				quantity
				equipped
				attuned
				contains {
					__typename
					id
					quantity
					equipped
					attuned
					contains {
						__typename
						id
						quantity
						equipped
						attuned
						contains {
							__typename
							id
							quantity
							equipped
							attuned
							contains {
								__typename
								id
								quantity
								equipped
								attuned
								contains {
									__typename
									id
									quantity
									equipped
									attuned
									contains {
										__typename
										id
										quantity
										equipped
										attuned
										contains {
											__typename
											id
											quantity
											equipped
											attuned
											contains {
												__typename
												id
												quantity
												equipped
												attuned
												contains { __typename }
												possessions { __typename }
											}
											possessions {
												__typename
												id
												label
												value
												desc
											}
										}
										possessions {
											__typename
											id
											label
											value
											desc
										}
									}
									possessions {
										__typename
										id
										label
										value
										desc
									}
								}
								possessions {
									__typename
									id
									label
									value
									desc
								}
							}
							possessions {
								__typename
								id
								label
								value
								desc
							}
						}
						possessions {
							__typename
							id
							label
							value
							desc
						}
					}
					possessions {
						__typename
						id
						label
						value
						desc
					}
				}
				possessions {
					__typename
					id
					label
					value
					desc
				}
			}
			possessions {
				__typename
				id
				label
				value
				desc
			}
		}
		possessions {
			__typename
			id
			label
			value
			desc
		}
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateEquipmentArgs, {batchCreateEquipment: APITypes.Mutation['batchCreateEquipment']}>;

export const createClass = /* GraphQL */ `
mutation CreateClass($input: ClassInput!) {
  createClass(input: $input) {
	__typename
	id
	label
	value
	desc
	attributes
	category
	details {
		__typename
		label
		value
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
		value
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
		value
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	desc
	attributes
	category
	details {
		__typename
		label
		value
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
		value
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
		value
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	desc
	attributes
	category
	details {
		__typename
		label
		value
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
		value
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
		value
	}
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	label
	desc
	advancement
	hitpoint
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
			ability
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
		id
		quantity
		equipped
		attuned
		contains {
			__typename
			id
			quantity
			equipped
			attuned
			contains {
				__typename
				id
				quantity
				equipped
				attuned
				contains {
					__typename
					id
					quantity
					equipped
					attuned
					contains {
						__typename
						id
						quantity
						equipped
						attuned
						contains {
							__typename
							id
							quantity
							equipped
							attuned
							contains {
								__typename
								id
								quantity
								equipped
								attuned
								contains {
									__typename
									id
									quantity
									equipped
									attuned
									contains {
										__typename
										id
										quantity
										equipped
										attuned
										contains {
											__typename
											id
											quantity
											equipped
											attuned
											contains {
												__typename
												id
												quantity
												equipped
												attuned
												contains { __typename }
												possessions { __typename }
											}
											possessions {
												__typename
												id
												label
												value
												desc
											}
										}
										possessions {
											__typename
											id
											label
											value
											desc
										}
									}
									possessions {
										__typename
										id
										label
										value
										desc
									}
								}
								possessions {
									__typename
									id
									label
									value
									desc
								}
							}
							possessions {
								__typename
								id
								label
								value
								desc
							}
						}
						possessions {
							__typename
							id
							label
							value
							desc
						}
					}
					possessions {
						__typename
						id
						label
						value
						desc
					}
				}
				possessions {
					__typename
					id
					label
					value
					desc
				}
			}
			possessions {
				__typename
				id
				label
				value
				desc
			}
		}
		possessions {
			__typename
			id
			label
			value
			desc
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
		proficiencyId
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
		expertiseId
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
		modifierId
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
	value
	label
	desc
	advancement
	hitpoint
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
			ability
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
		id
		quantity
		equipped
		attuned
		contains {
			__typename
			id
			quantity
			equipped
			attuned
			contains {
				__typename
				id
				quantity
				equipped
				attuned
				contains {
					__typename
					id
					quantity
					equipped
					attuned
					contains {
						__typename
						id
						quantity
						equipped
						attuned
						contains {
							__typename
							id
							quantity
							equipped
							attuned
							contains {
								__typename
								id
								quantity
								equipped
								attuned
								contains {
									__typename
									id
									quantity
									equipped
									attuned
									contains {
										__typename
										id
										quantity
										equipped
										attuned
										contains {
											__typename
											id
											quantity
											equipped
											attuned
											contains {
												__typename
												id
												quantity
												equipped
												attuned
												contains { __typename }
												possessions { __typename }
											}
											possessions {
												__typename
												id
												label
												value
												desc
											}
										}
										possessions {
											__typename
											id
											label
											value
											desc
										}
									}
									possessions {
										__typename
										id
										label
										value
										desc
									}
								}
								possessions {
									__typename
									id
									label
									value
									desc
								}
							}
							possessions {
								__typename
								id
								label
								value
								desc
							}
						}
						possessions {
							__typename
							id
							label
							value
							desc
						}
					}
					possessions {
						__typename
						id
						label
						value
						desc
					}
				}
				possessions {
					__typename
					id
					label
					value
					desc
				}
			}
			possessions {
				__typename
				id
				label
				value
				desc
			}
		}
		possessions {
			__typename
			id
			label
			value
			desc
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
		proficiencyId
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
		expertiseId
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
		modifierId
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

export const createBackground = /* GraphQL */ `
mutation CreateBackground($input: BackgroundInput!) {
  createBackground(input: $input) {
	__typename
	id
	label
	value
	desc
	details {
		__typename
		label
		value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	desc
	details {
		__typename
		label
		value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	value
	desc
	details {
		__typename
		label
		value
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
	features {
		__typename
		id
		label
		value
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
		feats {
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
		modifiers {
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
			charge {
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
		expertise {
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
		senses {
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
		spells {
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
				spells
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
		options {
			__typename
			id
			label
			value
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
			feats {
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
			modifiers {
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
				charge {
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
			expertise {
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
			senses {
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
			spells {
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
					spells
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
	ownerId
	systemId
	masterId
  }
}
`as GeneratedMutation<APITypes.MutationBatchCreateBackgroundsArgs, {batchCreateBackgrounds: APITypes.Mutation['batchCreateBackgrounds']}>;

