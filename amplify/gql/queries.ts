/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedQuery<InputType, OutputType> = string & {
    __generatedQueryInput: InputType;
    __generatedQueryOutput: OutputType;
  };

export const listMasterSystems = /* GraphQL */ `
query ListMasterSystems {
  listMasterSystems {
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
`as GeneratedQuery<{}, {listMasterSystems: APITypes.Query['listMasterSystems']}>;

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

export const listMasterSpells = /* GraphQL */ `
query ListMasterSpells {
  listMasterSpells {
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
`as GeneratedQuery<{}, {listMasterSpells: APITypes.Query['listMasterSpells']}>;

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
query ListSpells($systemId: String!) {
  listSpells(systemId: $systemId) {
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
	message
  }
}
`as GeneratedQuery<APITypes.QueryListSpellsArgs, {listSpells: APITypes.Query['listSpells']}>;

export const listMasterRaces = /* GraphQL */ `
query ListMasterRaces {
  listMasterRaces {
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
				options {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
					subfeatures {
						__typename
						id
						label
						value
						desc
						detail
						category
						ancestries {
							__typename
							id
							attributes
							origin
							options
							selectionCount
							subtype
						}
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
						selectionCount
						levelAvailable
					}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<{}, {listMasterRaces: APITypes.Query['listMasterRaces']}>;

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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
				options {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
					subfeatures {
						__typename
						id
						label
						value
						desc
						detail
						category
						ancestries {
							__typename
							id
							attributes
							origin
							options
							selectionCount
							subtype
						}
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
						selectionCount
						levelAvailable
					}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<APITypes.QueryGetRaceArgs, {getRace: APITypes.Query['getRace']}>;

export const listRaces = /* GraphQL */ `
query ListRaces($limit: Int, $nextToken: String, $systemId: String!) {
  listRaces(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
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
					selectionCount
					levelAvailable
					subfeatures {
						__typename
						id
						label
						value
						desc
						detail
						category
						ancestries {
							__typename
							id
							attributes
							origin
							options
							selectionCount
							subtype
						}
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
						selectionCount
						levelAvailable
					}
					options {
						__typename
						id
						label
						value
						desc
						detail
						category
						ancestries {
							__typename
							id
							attributes
							origin
							options
							selectionCount
							subtype
						}
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
						selectionCount
						levelAvailable
						subfeatures {
							__typename
							id
							label
							value
							desc
							detail
							category
							ancestries {
								__typename
								id
								attributes
								origin
								options
								selectionCount
								subtype
							}
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
							selectionCount
							levelAvailable
						}
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
			options {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
			}
		}
		ownerId
		systemId
		masterId
	}
	nextToken
	message
  }
}
`as GeneratedQuery<APITypes.QueryListRacesArgs, {listRaces: APITypes.Query['listRaces']}>;

export const listMasterFeats = /* GraphQL */ `
query ListMasterFeats {
  listMasterFeats {
	__typename
	id
	label
	value
	desc
	detail
	category
	ancestry {
		__typename
		id
		attributes
		origin
		options
		selectionCount
		subtype
	}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<{}, {listMasterFeats: APITypes.Query['listMasterFeats']}>;

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
	ancestry {
		__typename
		id
		attributes
		origin
		options
		selectionCount
		subtype
	}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<APITypes.QueryGetFeatArgs, {getFeat: APITypes.Query['getFeat']}>;

export const listFeats = /* GraphQL */ `
query ListFeats($limit: Int, $nextToken: String, $systemId: String!) {
  listFeats(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
	__typename
	items {
		__typename
		id
		label
		value
		desc
		detail
		category
		ancestry {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
			options {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
		ownerId
		systemId
		masterId
	}
	nextToken
	message
  }
}
`as GeneratedQuery<APITypes.QueryListFeatsArgs, {listFeats: APITypes.Query['listFeats']}>;

export const listMasterEquipment = /* GraphQL */ `
query ListMasterEquipment {
  listMasterEquipment {
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
		equipment
		quantity
		contains {
			__typename
			equipment
			quantity
			contains {
				__typename
				equipment
				quantity
				contains {
					__typename
					equipment
					quantity
					contains {
						__typename
						equipment
						quantity
						contains {
							__typename
							equipment
							quantity
							contains {
								__typename
								equipment
								quantity
								contains {
									__typename
									equipment
									quantity
									contains {
										__typename
										equipment
										quantity
										contains {
											__typename
											equipment
											quantity
											contains {
												__typename
												equipment
												quantity
												contains { __typename }
												currencies { __typename }
											}
											currencies {
												__typename
												id
												amount
											}
										}
										currencies {
											__typename
											id
											amount
										}
									}
									currencies {
										__typename
										id
										amount
									}
								}
								currencies {
									__typename
									id
									amount
								}
							}
							currencies {
								__typename
								id
								amount
							}
						}
						currencies {
							__typename
							id
							amount
						}
					}
					currencies {
						__typename
						id
						amount
					}
				}
				currencies {
					__typename
					id
					amount
				}
			}
			currencies {
				__typename
				id
				amount
			}
		}
		currencies {
			__typename
			id
			amount
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
	rank
  }
}
`as GeneratedQuery<{}, {listMasterEquipment: APITypes.Query['listMasterEquipment']}>;

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
		equipment
		quantity
		contains {
			__typename
			equipment
			quantity
			contains {
				__typename
				equipment
				quantity
				contains {
					__typename
					equipment
					quantity
					contains {
						__typename
						equipment
						quantity
						contains {
							__typename
							equipment
							quantity
							contains {
								__typename
								equipment
								quantity
								contains {
									__typename
									equipment
									quantity
									contains {
										__typename
										equipment
										quantity
										contains {
											__typename
											equipment
											quantity
											contains {
												__typename
												equipment
												quantity
												contains { __typename }
												currencies { __typename }
											}
											currencies {
												__typename
												id
												amount
											}
										}
										currencies {
											__typename
											id
											amount
										}
									}
									currencies {
										__typename
										id
										amount
									}
								}
								currencies {
									__typename
									id
									amount
								}
							}
							currencies {
								__typename
								id
								amount
							}
						}
						currencies {
							__typename
							id
							amount
						}
					}
					currencies {
						__typename
						id
						amount
					}
				}
				currencies {
					__typename
					id
					amount
				}
			}
			currencies {
				__typename
				id
				amount
			}
		}
		currencies {
			__typename
			id
			amount
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
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
query ListEquipment($limit: Int, $nextToken: String, $systemId: String!) {
  listEquipment(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
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
			equipment
			quantity
			contains {
				__typename
				equipment
				quantity
				contains {
					__typename
					equipment
					quantity
					contains {
						__typename
						equipment
						quantity
						contains {
							__typename
							equipment
							quantity
							contains {
								__typename
								equipment
								quantity
								contains {
									__typename
									equipment
									quantity
									contains {
										__typename
										equipment
										quantity
										contains {
											__typename
											equipment
											quantity
											contains {
												__typename
												equipment
												quantity
												contains { __typename }
												currencies { __typename }
											}
											currencies {
												__typename
												id
												amount
											}
										}
										currencies {
											__typename
											id
											amount
										}
									}
									currencies {
										__typename
										id
										amount
									}
								}
								currencies {
									__typename
									id
									amount
								}
							}
							currencies {
								__typename
								id
								amount
							}
						}
						currencies {
							__typename
							id
							amount
						}
					}
					currencies {
						__typename
						id
						amount
					}
				}
				currencies {
					__typename
					id
					amount
				}
			}
			currencies {
				__typename
				id
				amount
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
			options {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
			}
		}
		ownerId
		systemId
		masterId
		rank
	}
	nextToken
	message
  }
}
`as GeneratedQuery<APITypes.QueryListEquipmentArgs, {listEquipment: APITypes.Query['listEquipment']}>;

export const listMasterClasses = /* GraphQL */ `
query ListMasterClasses {
  listMasterClasses {
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
		copper
		silver
		electrum
		gold
		platinum
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<{}, {listMasterClasses: APITypes.Query['listMasterClasses']}>;

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
		copper
		silver
		electrum
		gold
		platinum
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<APITypes.QueryGetClassArgs, {getClass: APITypes.Query['getClass']}>;

export const listClasses = /* GraphQL */ `
query ListClasses($systemId: String!) {
  listClasses(systemId: $systemId) {
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
			copper
			silver
			electrum
			gold
			platinum
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
			options {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
			}
		}
		ownerId
		systemId
		masterId
	}
	nextToken
	message
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
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionIndex
		}
		spellSlots {
			__typename
			level
			used
			classId
		}
	}
	startingEquipment {
		__typename
		option
		goldOption
		totalGold
		spentGold
		equipment
	}
	equipment {
		__typename
		possessions {
			__typename
			id
			label
			value
			desc
		}
		equipment {
			__typename
			equipment
			quantity
			contains {
				__typename
				equipment
				quantity
				contains {
					__typename
					equipment
					quantity
					contains {
						__typename
						equipment
						quantity
						contains {
							__typename
							equipment
							quantity
							contains {
								__typename
								equipment
								quantity
								contains {
									__typename
									equipment
									quantity
									contains {
										__typename
										equipment
										quantity
										contains {
											__typename
											equipment
											quantity
											contains {
												__typename
												equipment
												quantity
												contains { __typename }
												currencies { __typename }
											}
											currencies {
												__typename
												id
												amount
											}
										}
										currencies {
											__typename
											id
											amount
										}
									}
									currencies {
										__typename
										id
										amount
									}
								}
								currencies {
									__typename
									id
									amount
								}
							}
							currencies {
								__typename
								id
								amount
							}
						}
						currencies {
							__typename
							id
							amount
						}
					}
					currencies {
						__typename
						id
						amount
					}
				}
				currencies {
					__typename
					id
					amount
				}
			}
			currencies {
				__typename
				id
				amount
			}
		}
		currencies {
			__typename
			id
			amount
		}
	}
	features {
		__typename
		id
		option
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionIndex
		level
	}
	feats {
		__typename
		featId
		featureId
		featureOptionId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		optionId
		optionIndex
	}
	proficiencies {
		__typename
		proficiencyId
		featureId
		featureOptionId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
	}
	expertise {
		__typename
		expertiseId
		featureId
		featureOptionId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
	}
	modifiers {
		__typename
		modifierId
		featureId
		featureOptionId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
	}
	senses {
		__typename
		senseId
		featureId
		featureOptionId
		classId
		raceId
		ancestryId
		equipmentId
		backgroundId
		featId
		optionId
		optionIndex
	}
	ownerId
	systemId
  }
}
`as GeneratedQuery<APITypes.QueryGetCharacterArgs, {getCharacter: APITypes.Query['getCharacter']}>;

export const listCharacters = /* GraphQL */ `
query ListCharacters($limit: Int, $nextToken: String, $systemId: String!) {
  listCharacters(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
	__typename
	items {
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
				featureOptionId
				classId
				raceId
				ancestryId
				equipmentId
				backgroundId
				featId
				optionIndex
			}
			spellSlots {
				__typename
				level
				used
				classId
			}
		}
		startingEquipment {
			__typename
			option
			goldOption
			totalGold
			spentGold
			equipment
		}
		equipment {
			__typename
			possessions {
				__typename
				id
				label
				value
				desc
			}
			equipment {
				__typename
				equipment
				quantity
				contains {
					__typename
					equipment
					quantity
					contains {
						__typename
						equipment
						quantity
						contains {
							__typename
							equipment
							quantity
							contains {
								__typename
								equipment
								quantity
								contains {
									__typename
									equipment
									quantity
									contains {
										__typename
										equipment
										quantity
										contains {
											__typename
											equipment
											quantity
											contains {
												__typename
												equipment
												quantity
												contains { __typename }
												currencies { __typename }
											}
											currencies {
												__typename
												id
												amount
											}
										}
										currencies {
											__typename
											id
											amount
										}
									}
									currencies {
										__typename
										id
										amount
									}
								}
								currencies {
									__typename
									id
									amount
								}
							}
							currencies {
								__typename
								id
								amount
							}
						}
						currencies {
							__typename
							id
							amount
						}
					}
					currencies {
						__typename
						id
						amount
					}
				}
				currencies {
					__typename
					id
					amount
				}
			}
			currencies {
				__typename
				id
				amount
			}
		}
		features {
			__typename
			id
			option
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionIndex
			level
		}
		feats {
			__typename
			featId
			featureId
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			optionId
			optionIndex
		}
		proficiencies {
			__typename
			proficiencyId
			featureId
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
		}
		expertise {
			__typename
			expertiseId
			featureId
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
		}
		modifiers {
			__typename
			modifierId
			featureId
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
		}
		senses {
			__typename
			senseId
			featureId
			featureOptionId
			classId
			raceId
			ancestryId
			equipmentId
			backgroundId
			featId
			optionId
			optionIndex
		}
		ownerId
		systemId
	}
	nextToken
	message
  }
}
`as GeneratedQuery<APITypes.QueryListCharactersArgs, {listCharacters: APITypes.Query['listCharacters']}>;

export const listMasterBackgrounds = /* GraphQL */ `
query ListMasterBackgrounds {
  listMasterBackgrounds {
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
		copper
		silver
		electrum
		gold
		platinum
	}
	currency {
		__typename
		copper
		silver
		electrum
		gold
		platinum
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<{}, {listMasterBackgrounds: APITypes.Query['listMasterBackgrounds']}>;

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
		copper
		silver
		electrum
		gold
		platinum
	}
	currency {
		__typename
		copper
		silver
		electrum
		gold
		platinum
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
		ancestries {
			__typename
			id
			attributes
			origin
			options
			selectionCount
			subtype
		}
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
		selectionCount
		levelAvailable
		subfeatures {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
		}
		options {
			__typename
			id
			label
			value
			desc
			detail
			category
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
		}
	}
	ownerId
	systemId
	masterId
  }
}
`as GeneratedQuery<APITypes.QueryGetBackgroundArgs, {getBackground: APITypes.Query['getBackground']}>;

export const listBackgrounds = /* GraphQL */ `
query ListBackgrounds($systemId: String!) {
  listBackgrounds(systemId: $systemId) {
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
			copper
			silver
			electrum
			gold
			platinum
		}
		currency {
			__typename
			copper
			silver
			electrum
			gold
			platinum
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
			ancestries {
				__typename
				id
				attributes
				origin
				options
				selectionCount
				subtype
			}
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
			selectionCount
			levelAvailable
			subfeatures {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
			}
			options {
				__typename
				id
				label
				value
				desc
				detail
				category
				ancestries {
					__typename
					id
					attributes
					origin
					options
					selectionCount
					subtype
				}
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
				selectionCount
				levelAvailable
				subfeatures {
					__typename
					id
					label
					value
					desc
					detail
					category
					ancestries {
						__typename
						id
						attributes
						origin
						options
						selectionCount
						subtype
					}
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
					selectionCount
					levelAvailable
				}
			}
		}
		ownerId
		systemId
		masterId
	}
	nextToken
	message
  }
}
`as GeneratedQuery<APITypes.QueryListBackgroundsArgs, {listBackgrounds: APITypes.Query['listBackgrounds']}>;

