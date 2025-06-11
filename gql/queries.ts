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
`as GeneratedQuery<APITypes.QueryGetMasterSystemArgs, {getMasterSystem: APITypes.Query['getMasterSystem']}>;

export const listMasterSystems = /* GraphQL */ `
query ListMasterSystems($limit: Int, $nextToken: String) {
  listMasterSystems(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
		__typename
		id
		label
		desc
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
`as GeneratedQuery<APITypes.QueryGetSystemArgs, {getSystem: APITypes.Query['getSystem']}>;

export const listSystems = /* GraphQL */ `
query ListSystems($limit: Int, $nextToken: String) {
  listSystems(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
		__typename
		id
		label
		desc
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
		desc
		requirements
		materialDesc
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		attributes {
			__typename
			spellIds
			id
		}
		primaryDamages {
			__typename
			spellIds
			id
		}
		secondaryDamages {
			__typename
			spellIds
			id
		}
		primaryActions {
			__typename
			spellIds
			id
			amount
		}
		secondaryActions {
			__typename
			spellIds
			id
			amount
		}
		conditions {
			__typename
			spellIds
			id
		}
		classes {
			__typename
			spellIds
			id
		}
		durations {
			__typename
			id
			spellIds
			amount
		}
		ranges {
			__typename
			id
			spellIds
			unit
			minRange
			maxRange
			distance
		}
		shapes {
			__typename
			id
			spellIds
			size
			unit
		}
		schools {
			__typename
			spellIds
			id
		}
		levels {
			__typename
			spellIds
			id
		}
		saveAbilities {
			__typename
			spellIds
			id
		}
		requirements {
			__typename
			spellIds
			id
		}
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
		desc
		requirements
		materialDesc
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		attributes {
			__typename
			spellIds
			id
		}
		primaryDamages {
			__typename
			spellIds
			id
		}
		secondaryDamages {
			__typename
			spellIds
			id
		}
		primaryActions {
			__typename
			spellIds
			id
			amount
		}
		secondaryActions {
			__typename
			spellIds
			id
			amount
		}
		conditions {
			__typename
			spellIds
			id
		}
		classes {
			__typename
			spellIds
			id
		}
		durations {
			__typename
			id
			spellIds
			amount
		}
		ranges {
			__typename
			id
			spellIds
			unit
			minRange
			maxRange
			distance
		}
		shapes {
			__typename
			id
			spellIds
			size
			unit
		}
		schools {
			__typename
			spellIds
			id
		}
		levels {
			__typename
			spellIds
			id
		}
		saveAbilities {
			__typename
			spellIds
			id
		}
		requirements {
			__typename
			spellIds
			id
		}
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
		options {
			__typename
			id
			label
			desc
			features
		}
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
	features {
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
		quote
		desc
		details {
			__typename
			label
			desc
		}
		systemId
		masterId
	}
	metaData {
		__typename
		categories {
			__typename
			raceIds
			id
		}
		playable {
			__typename
			raceIds
			id
		}
		lineages {
			__typename
			raceIds
			id
		}
		features {
			__typename
			id
			label
			raceIds
		}
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
		options {
			__typename
			id
			label
			desc
			features
		}
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
	features {
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
		quote
		desc
		details {
			__typename
			label
			desc
		}
		systemId
		masterId
	}
	metaData {
		__typename
		categories {
			__typename
			raceIds
			id
		}
		playable {
			__typename
			raceIds
			id
		}
		lineages {
			__typename
			raceIds
			id
		}
		features {
			__typename
			id
			label
			raceIds
		}
	}
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListRacesArgs, {listRaces: APITypes.Query['listRaces']}>;

export const getMasterFeatureSpell = /* GraphQL */ `
query GetMasterFeatureSpell($id: ID!) {
  getMasterFeatureSpell(id: $id) {
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
}
`as GeneratedQuery<APITypes.QueryGetMasterFeatureSpellArgs, {getMasterFeatureSpell: APITypes.Query['getMasterFeatureSpell']}>;

export const listMasterFeatureSpells = /* GraphQL */ `
query ListMasterFeatureSpells($limit: Int, $nextToken: String) {
  listMasterFeatureSpells(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureSpellsArgs, {listMasterFeatureSpells: APITypes.Query['listMasterFeatureSpells']}>;

export const getFeatureSpell = /* GraphQL */ `
query GetFeatureSpell($id: ID!) {
  getFeatureSpell(id: $id) {
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
}
`as GeneratedQuery<APITypes.QueryGetFeatureSpellArgs, {getFeatureSpell: APITypes.Query['getFeatureSpell']}>;

export const listFeatureSpells = /* GraphQL */ `
query ListFeatureSpells($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureSpells(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureSpellsArgs, {listFeatureSpells: APITypes.Query['listFeatureSpells']}>;

export const getMasterFeatureSense = /* GraphQL */ `
query GetMasterFeatureSense($id: ID!) {
  getMasterFeatureSense(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureSenseArgs, {getMasterFeatureSense: APITypes.Query['getMasterFeatureSense']}>;

export const listMasterFeatureSenses = /* GraphQL */ `
query ListMasterFeatureSenses($limit: Int, $nextToken: String) {
  listMasterFeatureSenses(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureSensesArgs, {listMasterFeatureSenses: APITypes.Query['listMasterFeatureSenses']}>;

export const getFeatureSense = /* GraphQL */ `
query GetFeatureSense($id: ID!) {
  getFeatureSense(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureSenseArgs, {getFeatureSense: APITypes.Query['getFeatureSense']}>;

export const listFeatureSenses = /* GraphQL */ `
query ListFeatureSenses($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureSenses(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureSensesArgs, {listFeatureSenses: APITypes.Query['listFeatureSenses']}>;

export const getMasterFeatureProficiency = /* GraphQL */ `
query GetMasterFeatureProficiency($id: ID!) {
  getMasterFeatureProficiency(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureProficiencyArgs, {getMasterFeatureProficiency: APITypes.Query['getMasterFeatureProficiency']}>;

export const listMasterFeatureProficiencies = /* GraphQL */ `
query ListMasterFeatureProficiencies($limit: Int, $nextToken: String) {
  listMasterFeatureProficiencies(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureProficienciesArgs, {listMasterFeatureProficiencies: APITypes.Query['listMasterFeatureProficiencies']}>;

export const getFeatureProficiency = /* GraphQL */ `
query GetFeatureProficiency($id: ID!) {
  getFeatureProficiency(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureProficiencyArgs, {getFeatureProficiency: APITypes.Query['getFeatureProficiency']}>;

export const listFeatureProficiencies = /* GraphQL */ `
query ListFeatureProficiencies($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureProficiencies(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureProficienciesArgs, {listFeatureProficiencies: APITypes.Query['listFeatureProficiencies']}>;

export const getMasterFeatureOption = /* GraphQL */ `
query GetMasterFeatureOption($id: ID!) {
  getMasterFeatureOption(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureOptionArgs, {getMasterFeatureOption: APITypes.Query['getMasterFeatureOption']}>;

export const listMasterFeatureOptions = /* GraphQL */ `
query ListMasterFeatureOptions($limit: Int, $nextToken: String) {
  listMasterFeatureOptions(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureOptionsArgs, {listMasterFeatureOptions: APITypes.Query['listMasterFeatureOptions']}>;

export const getFeatureOption = /* GraphQL */ `
query GetFeatureOption($id: ID!) {
  getFeatureOption(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureOptionArgs, {getFeatureOption: APITypes.Query['getFeatureOption']}>;

export const listFeatureOptions = /* GraphQL */ `
query ListFeatureOptions($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureOptions(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureOptionsArgs, {listFeatureOptions: APITypes.Query['listFeatureOptions']}>;

export const getMasterFeatureModifier = /* GraphQL */ `
query GetMasterFeatureModifier($id: ID!) {
  getMasterFeatureModifier(id: $id) {
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
}
`as GeneratedQuery<APITypes.QueryGetMasterFeatureModifierArgs, {getMasterFeatureModifier: APITypes.Query['getMasterFeatureModifier']}>;

export const listMasterFeatureModifiers = /* GraphQL */ `
query ListMasterFeatureModifiers($limit: Int, $nextToken: String) {
  listMasterFeatureModifiers(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureModifiersArgs, {listMasterFeatureModifiers: APITypes.Query['listMasterFeatureModifiers']}>;

export const getFeatureModifier = /* GraphQL */ `
query GetFeatureModifier($id: ID!) {
  getFeatureModifier(id: $id) {
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
}
`as GeneratedQuery<APITypes.QueryGetFeatureModifierArgs, {getFeatureModifier: APITypes.Query['getFeatureModifier']}>;

export const listFeatureModifiers = /* GraphQL */ `
query ListFeatureModifiers($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureModifiers(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureModifiersArgs, {listFeatureModifiers: APITypes.Query['listFeatureModifiers']}>;

export const getMasterFeatureFeat = /* GraphQL */ `
query GetMasterFeatureFeat($id: ID!) {
  getMasterFeatureFeat(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureFeatArgs, {getMasterFeatureFeat: APITypes.Query['getMasterFeatureFeat']}>;

export const listMasterFeatureFeats = /* GraphQL */ `
query ListMasterFeatureFeats($limit: Int, $nextToken: String) {
  listMasterFeatureFeats(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureFeatsArgs, {listMasterFeatureFeats: APITypes.Query['listMasterFeatureFeats']}>;

export const getFeatureFeat = /* GraphQL */ `
query GetFeatureFeat($id: ID!) {
  getFeatureFeat(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureFeatArgs, {getFeatureFeat: APITypes.Query['getFeatureFeat']}>;

export const listFeatureFeats = /* GraphQL */ `
query ListFeatureFeats($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureFeats(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureFeatsArgs, {listFeatureFeats: APITypes.Query['listFeatureFeats']}>;

export const getMasterFeatureExpertise = /* GraphQL */ `
query GetMasterFeatureExpertise($id: ID!) {
  getMasterFeatureExpertise(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureExpertiseArgs, {getMasterFeatureExpertise: APITypes.Query['getMasterFeatureExpertise']}>;

export const listMasterFeatureExpertises = /* GraphQL */ `
query ListMasterFeatureExpertises($limit: Int, $nextToken: String) {
  listMasterFeatureExpertises(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeatureExpertisesArgs, {listMasterFeatureExpertises: APITypes.Query['listMasterFeatureExpertises']}>;

export const getFeatureExpertise = /* GraphQL */ `
query GetFeatureExpertise($id: ID!) {
  getFeatureExpertise(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureExpertiseArgs, {getFeatureExpertise: APITypes.Query['getFeatureExpertise']}>;

export const listFeatureExpertises = /* GraphQL */ `
query ListFeatureExpertises($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatureExpertises(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeatureExpertisesArgs, {listFeatureExpertises: APITypes.Query['listFeatureExpertises']}>;

export const getMasterFeature = /* GraphQL */ `
query GetMasterFeature($id: ID!) {
  getMasterFeature(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterFeatureArgs, {getMasterFeature: APITypes.Query['getMasterFeature']}>;

export const listMasterFeatures = /* GraphQL */ `
query ListMasterFeatures($limit: Int, $nextToken: String) {
  listMasterFeatures(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterFeaturesArgs, {listMasterFeatures: APITypes.Query['listMasterFeatures']}>;

export const getFeature = /* GraphQL */ `
query GetFeature($id: ID!) {
  getFeature(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetFeatureArgs, {getFeature: APITypes.Query['getFeature']}>;

export const listFeatures = /* GraphQL */ `
query ListFeatures($systemId: ID!, $limit: Int, $nextToken: String) {
  listFeatures(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListFeaturesArgs, {listFeatures: APITypes.Query['listFeatures']}>;

export const getMasterFeat = /* GraphQL */ `
query GetMasterFeat($id: ID!) {
  getMasterFeat(id: $id) {
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
	features {
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
	options {
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
		desc
		detail
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		features {
			__typename
			id
			label
			featIds
		}
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
	features {
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
	options {
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
		desc
		detail
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		features {
			__typename
			id
			label
			featIds
		}
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
	features {
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
		systemId
		masterId
		rank
	}
	metaData {
		__typename
		categories {
			__typename
			equipmentIds
			id
		}
		properties {
			__typename
			equipmentIds
			id
		}
		primaryDamages {
			__typename
			equipmentIds
			id
		}
		secondaryDamages {
			__typename
			equipmentIds
			id
		}
		versatileDamages {
			__typename
			equipmentIds
			id
		}
		armorClasses {
			__typename
			equipmentIds
			id
		}
		cost {
			__typename
			equipmentIds
			amount
			id
		}
		weight {
			__typename
			equipmentIds
			amount
			id
		}
		features {
			__typename
			id
			label
			equipmentIds
		}
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
	features {
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
		systemId
		masterId
		rank
	}
	metaData {
		__typename
		categories {
			__typename
			equipmentIds
			id
		}
		properties {
			__typename
			equipmentIds
			id
		}
		primaryDamages {
			__typename
			equipmentIds
			id
		}
		secondaryDamages {
			__typename
			equipmentIds
			id
		}
		versatileDamages {
			__typename
			equipmentIds
			id
		}
		armorClasses {
			__typename
			equipmentIds
			id
		}
		cost {
			__typename
			equipmentIds
			amount
			id
		}
		weight {
			__typename
			equipmentIds
			amount
			id
		}
		features {
			__typename
			id
			label
			equipmentIds
		}
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
	features {
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
		desc
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		categories {
			__typename
			classIds
			id
		}
		parentClasses {
			__typename
			classIds
			id
		}
		primaryAbilities {
			__typename
			classIds
			id
			amount
		}
		secondaryAbilities {
			__typename
			classIds
			id
			amount
		}
		optionalAbilities {
			__typename
			classIds
			id
			amount
		}
		features {
			__typename
			id
			label
			classIds
		}
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
	features {
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
		desc
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		categories {
			__typename
			classIds
			id
		}
		parentClasses {
			__typename
			classIds
			id
		}
		primaryAbilities {
			__typename
			classIds
			id
			amount
		}
		secondaryAbilities {
			__typename
			classIds
			id
			amount
		}
		optionalAbilities {
			__typename
			classIds
			id
			amount
		}
		features {
			__typename
			id
			label
			classIds
		}
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
	features {
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
		desc
		details {
			__typename
			label
			desc
		}
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		features {
			__typename
			id
			label
			backgroundIds
		}
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
	features {
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
		desc
		details {
			__typename
			label
			desc
		}
		ownerId
		systemId
		masterId
	}
	metaData {
		__typename
		features {
			__typename
			id
			label
			backgroundIds
		}
	}
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListBackgroundsArgs, {listBackgrounds: APITypes.Query['listBackgrounds']}>;

export const getMasterAncestryFeature = /* GraphQL */ `
query GetMasterAncestryFeature($id: ID!) {
  getMasterAncestryFeature(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetMasterAncestryFeatureArgs, {getMasterAncestryFeature: APITypes.Query['getMasterAncestryFeature']}>;

export const listMasterAncestryFeatures = /* GraphQL */ `
query ListMasterAncestryFeatures($limit: Int, $nextToken: String) {
  listMasterAncestryFeatures(limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListMasterAncestryFeaturesArgs, {listMasterAncestryFeatures: APITypes.Query['listMasterAncestryFeatures']}>;

export const getAncestryFeature = /* GraphQL */ `
query GetAncestryFeature($id: ID!) {
  getAncestryFeature(id: $id) {
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
`as GeneratedQuery<APITypes.QueryGetAncestryFeatureArgs, {getAncestryFeature: APITypes.Query['getAncestryFeature']}>;

export const listAncestryFeatures = /* GraphQL */ `
query ListAncestryFeatures($systemId: ID!, $limit: Int, $nextToken: String) {
  listAncestryFeatures(systemId: $systemId, limit: $limit, nextToken: $nextToken) {
	__typename
	items {
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
	nextToken
  }
}
`as GeneratedQuery<APITypes.QueryListAncestryFeaturesArgs, {listAncestryFeatures: APITypes.Query['listAncestryFeatures']}>;

