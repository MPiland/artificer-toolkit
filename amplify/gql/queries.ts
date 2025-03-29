/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedQuery<InputType, OutputType> = string & {
    __generatedQueryInput: InputType;
    __generatedQueryOutput: OutputType;
  };

export const getMasterSystem = /* GraphQL */ `
query GetMasterSystem($id: ID!) {
  getMasterSystem(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterSystemArgs, {getMasterSystem: APITypes.Query['getMasterSystem']}>;

export const listMasterSystems = /* GraphQL */ `
query ListMasterSystems($limit: Int, $nextToken: String) {
  listMasterSystems(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterSystemsArgs, {listMasterSystems: APITypes.Query['listMasterSystems']}>;

export const getSystem = /* GraphQL */ `
query GetSystem($id: ID!) {
  getSystem(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetSystemArgs, {getSystem: APITypes.Query['getSystem']}>;

export const listSystems = /* GraphQL */ `
query ListSystems($limit: Int, $nextToken: String) {
  listSystems(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListSystemsArgs, {listSystems: APITypes.Query['listSystems']}>;

export const getMasterSpell = /* GraphQL */ `
query GetMasterSpell($id: ID!) {
  getMasterSpell(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterSpellArgs, {getMasterSpell: APITypes.Query['getMasterSpell']}>;

export const listMasterSpells = /* GraphQL */ `
query ListMasterSpells($limit: Int, $nextToken: String) {
  listMasterSpells(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterSpellsArgs, {listMasterSpells: APITypes.Query['listMasterSpells']}>;

export const getSpell = /* GraphQL */ `
query GetSpell($id: ID!) {
  getSpell(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetSpellArgs, {getSpell: APITypes.Query['getSpell']}>;

export const listSpells = /* GraphQL */ `
query ListSpells($systemId: ID!, $limit: Int, $nextToken: String) {
  listSpells(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListSpellsArgs, {listSpells: APITypes.Query['listSpells']}>;

export const getMasterRace = /* GraphQL */ `
query GetMasterRace($id: ID!) {
  getMasterRace(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterRaceArgs, {getMasterRace: APITypes.Query['getMasterRace']}>;

export const listMasterRaces = /* GraphQL */ `
query ListMasterRaces($limit: Int, $nextToken: String) {
  listMasterRaces(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterRacesArgs, {listMasterRaces: APITypes.Query['listMasterRaces']}>;

export const getRace = /* GraphQL */ `
query GetRace($id: ID!) {
  getRace(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetRaceArgs, {getRace: APITypes.Query['getRace']}>;

export const listRaces = /* GraphQL */ `
query ListRaces($systemId: ID!, $limit: Int, $nextToken: String) {
  listRaces(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListRacesArgs, {listRaces: APITypes.Query['listRaces']}>;

export const getMasterFeat = /* GraphQL */ `
query GetMasterFeat($id: ID!) {
  getMasterFeat(id: $id) {
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
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatArgs, {getMasterFeat: APITypes.Query['getMasterFeat']}>;

export const listMasterFeats = /* GraphQL */ `
query ListMasterFeats($limit: Int, $nextToken: String) {
  listMasterFeats(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatsArgs, {listMasterFeats: APITypes.Query['listMasterFeats']}>;

export const getFeat = /* GraphQL */ `
query GetFeat($id: ID!) {
  getFeat(id: $id) {
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
	prerequisites {
		__typename
		options
		skillProficiencies
		equipmentProficiencies {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		equipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		notEquipped {
			__typename
			numberEquipped
			category
			equipment
			properties
		}
		abilityScore {
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
`as GeneratedQuery<APITypes.QueryGetFeatArgs, {getFeat: APITypes.Query['getFeat']}>;

export const listFeats = /* GraphQL */ `
query ListFeats($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeats(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
		prerequisites {
			__typename
			options
			skillProficiencies
			equipmentProficiencies {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			equipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			notEquipped {
				__typename
				numberEquipped
				category
				equipment
				properties
			}
			abilityScore {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatsArgs, {listFeats: APITypes.Query['listFeats']}>;

export const getMasterEquipment = /* GraphQL */ `
query GetMasterEquipment($id: ID!) {
  getMasterEquipment(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterEquipmentArgs, {getMasterEquipment: APITypes.Query['getMasterEquipment']}>;

export const listMasterEquipment = /* GraphQL */ `
query ListMasterEquipment($limit: Int, $nextToken: String) {
  listMasterEquipment(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterEquipmentArgs, {listMasterEquipment: APITypes.Query['listMasterEquipment']}>;

export const getEquipment = /* GraphQL */ `
query GetEquipment($id: ID!) {
  getEquipment(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetEquipmentArgs, {getEquipment: APITypes.Query['getEquipment']}>;

export const listEquipment = /* GraphQL */ `
query ListEquipment($systemId: ID!, $limit: Int, $nextToken: String) {
  listEquipment(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListEquipmentArgs, {listEquipment: APITypes.Query['listEquipment']}>;

export const getMasterClass = /* GraphQL */ `
query GetMasterClass($id: ID!) {
  getMasterClass(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterClassArgs, {getMasterClass: APITypes.Query['getMasterClass']}>;

export const listMasterClasses = /* GraphQL */ `
query ListMasterClasses($limit: Int, $nextToken: String) {
  listMasterClasses(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterClassesArgs, {listMasterClasses: APITypes.Query['listMasterClasses']}>;

export const getClass = /* GraphQL */ `
query GetClass($id: ID!) {
  getClass(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetClassArgs, {getClass: APITypes.Query['getClass']}>;

export const listClasses = /* GraphQL */ `
query ListClasses($systemId: ID!, $limit: Int, $nextToken: String) {
  listClasses(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListClassesArgs, {listClasses: APITypes.Query['listClasses']}>;

export const getCharacter = /* GraphQL */ `
query GetCharacter($id: ID!) {
  getCharacter(id: $id) {
	__typename
	id
	value
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
`as GeneratedQuery<APITypes.QueryGetCharacterArgs, {getCharacter: APITypes.Query['getCharacter']}>;

export const listCharacters = /* GraphQL */ `
query ListCharacters($systemId: ID!, $limit: Int, $nextToken: String) {
  listCharacters(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
		__typename
		id
		value
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListCharactersArgs, {listCharacters: APITypes.Query['listCharacters']}>;

export const getMasterBackground = /* GraphQL */ `
query GetMasterBackground($id: ID!) {
  getMasterBackground(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterBackgroundArgs, {getMasterBackground: APITypes.Query['getMasterBackground']}>;

export const listMasterBackgrounds = /* GraphQL */ `
query ListMasterBackgrounds($limit: Int, $nextToken: String) {
  listMasterBackgrounds(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterBackgroundsArgs, {listMasterBackgrounds: APITypes.Query['listMasterBackgrounds']}>;

export const getBackground = /* GraphQL */ `
query GetBackground($id: ID!) {
  getBackground(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetBackgroundArgs, {getBackground: APITypes.Query['getBackground']}>;

export const listBackgrounds = /* GraphQL */ `
query ListBackgrounds($systemId: ID!, $limit: Int, $nextToken: String) {
  listBackgrounds(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListBackgroundsArgs, {listBackgrounds: APITypes.Query['listBackgrounds']}>;

