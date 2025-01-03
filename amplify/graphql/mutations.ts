/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createSystem = /* GraphQL */ `mutation CreateSystem($input: SystemInput!) {
  createSystem(input: $input) {
    id
    value
    label
    desc
    abilities {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    actions {
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
      __typename
    }
    alignments {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    attributes {
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
      __typename
    }
    categories {
      id
      value
      label
      features
      classes
      races
      __typename
    }
    characters {
      hitpointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      advancementMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellPointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      startingEquipmentOptions {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    charges {
      resets {
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
        __typename
      }
      limits {
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
        __typename
      }
      __typename
    }
    conditions {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    currencies {
      id
      value
      label
      desc
      conversions {
        copper
        silver
        gold
        electrum
        platinum
        __typename
      }
      __typename
    }
    damageTypes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    equipment {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      properties {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryProperties {
        id
        propertyId
        categoryId
        __typename
      }
      rarities {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    languages {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    modifiers {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      types {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      methods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellCategories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryTypes {
        id
        typeId
        categoryId
        __typename
      }
      typeMethods {
        id
        typeId
        methodId
        __typename
      }
      categoryMethods {
        id
        methodId
        typeId
        categoryId
        __typename
      }
      __typename
    }
    passives {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    prerequisites {
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
      __typename
    }
    proficiencies {
      levels {
        id
        value
        label
        multiplier
        __typename
      }
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    rules {
      measurements {
        amount {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        rounding {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        imperial {
          weight {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          volume {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          length {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          __typename
        }
        __typename
      }
      abilityGenerateMethod {
        id
        value
        label
        total
        options {
          id
          value
          label
          reduce
          __typename
        }
        __typename
      }
      __typename
    }
    senses {
      id
      value
      label
      creatureDesc
      monsterDesc
      type
      __typename
    }
    sizes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    skills {
      id
      value
      label
      desc
      abilityId
      __typename
    }
    speeds {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    spells {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      durations {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      ranges {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      schools {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      shapes {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      requirements {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    terrains {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    ownerId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateSystemMutationVariables,
  APITypes.CreateSystemMutation
>;
export const updateSystem = /* GraphQL */ `mutation UpdateSystem($input: SystemInput!) {
  updateSystem(input: $input) {
    id
    value
    label
    desc
    abilities {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    actions {
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
      __typename
    }
    alignments {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    attributes {
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
      __typename
    }
    categories {
      id
      value
      label
      features
      classes
      races
      __typename
    }
    characters {
      hitpointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      advancementMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellPointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      startingEquipmentOptions {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    charges {
      resets {
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
        __typename
      }
      limits {
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
        __typename
      }
      __typename
    }
    conditions {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    currencies {
      id
      value
      label
      desc
      conversions {
        copper
        silver
        gold
        electrum
        platinum
        __typename
      }
      __typename
    }
    damageTypes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    equipment {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      properties {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryProperties {
        id
        propertyId
        categoryId
        __typename
      }
      rarities {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    languages {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    modifiers {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      types {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      methods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellCategories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryTypes {
        id
        typeId
        categoryId
        __typename
      }
      typeMethods {
        id
        typeId
        methodId
        __typename
      }
      categoryMethods {
        id
        methodId
        typeId
        categoryId
        __typename
      }
      __typename
    }
    passives {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    prerequisites {
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
      __typename
    }
    proficiencies {
      levels {
        id
        value
        label
        multiplier
        __typename
      }
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    rules {
      measurements {
        amount {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        rounding {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        imperial {
          weight {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          volume {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          length {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          __typename
        }
        __typename
      }
      abilityGenerateMethod {
        id
        value
        label
        total
        options {
          id
          value
          label
          reduce
          __typename
        }
        __typename
      }
      __typename
    }
    senses {
      id
      value
      label
      creatureDesc
      monsterDesc
      type
      __typename
    }
    sizes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    skills {
      id
      value
      label
      desc
      abilityId
      __typename
    }
    speeds {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    spells {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      durations {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      ranges {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      schools {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      shapes {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      requirements {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    terrains {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    ownerId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateSystemMutationVariables,
  APITypes.UpdateSystemMutation
>;
export const deleteSystem = /* GraphQL */ `mutation DeleteSystem($id: ID!) {
  deleteSystem(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteSystemMutationVariables,
  APITypes.DeleteSystemMutation
>;
export const batchCreateSystems = /* GraphQL */ `mutation BatchCreateSystems($input: [BatchSystemsInput!]!) {
  batchCreateSystems(input: $input) {
    id
    value
    label
    desc
    abilities {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    actions {
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
      __typename
    }
    alignments {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    attributes {
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
      __typename
    }
    categories {
      id
      value
      label
      features
      classes
      races
      __typename
    }
    characters {
      hitpointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      advancementMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellPointCalcMethods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      startingEquipmentOptions {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    charges {
      resets {
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
        __typename
      }
      limits {
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
        __typename
      }
      __typename
    }
    conditions {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    currencies {
      id
      value
      label
      desc
      conversions {
        copper
        silver
        gold
        electrum
        platinum
        __typename
      }
      __typename
    }
    damageTypes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    equipment {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      properties {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryProperties {
        id
        propertyId
        categoryId
        __typename
      }
      rarities {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    languages {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    modifiers {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      types {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      methods {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      spellCategories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      categoryTypes {
        id
        typeId
        categoryId
        __typename
      }
      typeMethods {
        id
        typeId
        methodId
        __typename
      }
      categoryMethods {
        id
        methodId
        typeId
        categoryId
        __typename
      }
      __typename
    }
    passives {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    prerequisites {
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
      __typename
    }
    proficiencies {
      levels {
        id
        value
        label
        multiplier
        __typename
      }
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    rules {
      measurements {
        amount {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        rounding {
          id
          value
          label
          desc
          tooltip
          short
          __typename
        }
        imperial {
          weight {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          volume {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          length {
            id
            value
            label
            desc
            tooltip
            short
            __typename
          }
          __typename
        }
        __typename
      }
      abilityGenerateMethod {
        id
        value
        label
        total
        options {
          id
          value
          label
          reduce
          __typename
        }
        __typename
      }
      __typename
    }
    senses {
      id
      value
      label
      creatureDesc
      monsterDesc
      type
      __typename
    }
    sizes {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    skills {
      id
      value
      label
      desc
      abilityId
      __typename
    }
    speeds {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    spells {
      categories {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      durations {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      ranges {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      schools {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      shapes {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      requirements {
        id
        value
        label
        desc
        tooltip
        short
        __typename
      }
      __typename
    }
    terrains {
      id
      value
      label
      desc
      tooltip
      short
      __typename
    }
    ownerId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateSystemsMutationVariables,
  APITypes.BatchCreateSystemsMutation
>;
export const createSpell = /* GraphQL */ `mutation CreateSpell($input: SpellInput!) {
  createSpell(input: $input) {
    id
    label
    value
    desc
    level
    school
    classes
    attributes
    upcast {
      attributes
      levels {
        level
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        duration {
          id
          amount
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        __typename
      }
      __typename
    }
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    targets
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    conditions
    requirements
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    duration {
      id
      amount
      __typename
    }
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    materialDesc
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateSpellMutationVariables,
  APITypes.CreateSpellMutation
>;
export const updateSpell = /* GraphQL */ `mutation UpdateSpell($input: SpellInput!) {
  updateSpell(input: $input) {
    id
    label
    value
    desc
    level
    school
    classes
    attributes
    upcast {
      attributes
      levels {
        level
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        duration {
          id
          amount
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        __typename
      }
      __typename
    }
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    targets
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    conditions
    requirements
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    duration {
      id
      amount
      __typename
    }
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    materialDesc
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateSpellMutationVariables,
  APITypes.UpdateSpellMutation
>;
export const deleteSpell = /* GraphQL */ `mutation DeleteSpell($id: ID!) {
  deleteSpell(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteSpellMutationVariables,
  APITypes.DeleteSpellMutation
>;
export const batchCreateSpells = /* GraphQL */ `mutation BatchCreateSpells($input: [BatchSpellsInput]!) {
  batchCreateSpells(input: $input) {
    id
    label
    value
    desc
    level
    school
    classes
    attributes
    upcast {
      attributes
      levels {
        level
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        duration {
          id
          amount
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        __typename
      }
      __typename
    }
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    targets
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    conditions
    requirements
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    duration {
      id
      amount
      __typename
    }
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    materialDesc
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateSpellsMutationVariables,
  APITypes.BatchCreateSpellsMutation
>;
export const createRace = /* GraphQL */ `mutation CreateRace($input: RaceInput!) {
  createRace(input: $input) {
    id
    label
    value
    quote
    desc
    playable
    category
    lineage
    ancestry {
      id
      label
      value
      desc
      options {
        id
        value
        label
        desc
        features {
          id
          label
          value
          desc
          detail
          category
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          subfeatures {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            __typename
          }
          options {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            subfeatures {
              id
              label
              value
              desc
              detail
              category
              attributes
              targets
              selectionCount
              levelAvailable
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    details {
      label
      value
      desc
      __typename
    }
    traits {
      details {
        label
        value
        desc
        __typename
      }
      size
      speeds {
        walking
        swimming
        flying
        climbing
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateRaceMutationVariables,
  APITypes.CreateRaceMutation
>;
export const updateRace = /* GraphQL */ `mutation UpdateRace($input: RaceInput!) {
  updateRace(input: $input) {
    id
    label
    value
    quote
    desc
    playable
    category
    lineage
    ancestry {
      id
      label
      value
      desc
      options {
        id
        value
        label
        desc
        features {
          id
          label
          value
          desc
          detail
          category
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          subfeatures {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            __typename
          }
          options {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            subfeatures {
              id
              label
              value
              desc
              detail
              category
              attributes
              targets
              selectionCount
              levelAvailable
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    details {
      label
      value
      desc
      __typename
    }
    traits {
      details {
        label
        value
        desc
        __typename
      }
      size
      speeds {
        walking
        swimming
        flying
        climbing
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateRaceMutationVariables,
  APITypes.UpdateRaceMutation
>;
export const deleteRace = /* GraphQL */ `mutation DeleteRace($id: ID!) {
  deleteRace(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteRaceMutationVariables,
  APITypes.DeleteRaceMutation
>;
export const batchCreateRaces = /* GraphQL */ `mutation BatchCreateRaces($input: [BatchRacesInput!]!) {
  batchCreateRaces(input: $input) {
    id
    label
    value
    quote
    desc
    playable
    category
    lineage
    ancestry {
      id
      label
      value
      desc
      options {
        id
        value
        label
        desc
        features {
          id
          label
          value
          desc
          detail
          category
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          subfeatures {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            __typename
          }
          options {
            id
            label
            value
            desc
            detail
            category
            ancestries {
              id
              attributes
              origin
              options
              selectionCount
              subtype
              __typename
            }
            attributes
            actions {
              __typename
            }
            damage {
              attributes
              damageSave
              __typename
            }
            charges {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range {
              id
              minRange
              maxRange
              distance
              unit
              __typename
            }
            shape {
              id
              size
              unit
              __typename
            }
            targets
            feats {
              id
              attributes
              feats
              selectionCount
              subtype
              __typename
            }
            modifiers {
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
              dieCount
              dieValue
              dieShort
              feature
              skills
              saveAbilities
              abilities
              speeds
              range
              shape
              size
              duration
              unit
              conditions
              damageTypes
              spell
              spellCategory
              __typename
            }
            proficiencies {
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
              __typename
            }
            expertise {
              id
              subtype
              attributes
              selectionCount
              category
              saveAbilities
              skills
              languages
              __typename
            }
            senses {
              id
              attributes
              selectionCount
              subtype
              ids
              __typename
            }
            spells {
              id
              ids
              attributes
              selectionCount
              classLimit
              levelLimit
              attributeLimit
              ability
              spellLevel
              subtype
              __typename
            }
            prerequisites {
              options
              skillProficiencies
              spellsKnown
              featuresKnown
              optionsKnown
              size
              __typename
            }
            saveAbility {
              id
              minAmount
              attributes
              abilityModifier
              __typename
            }
            selectionCount
            levelAvailable
            subfeatures {
              id
              label
              value
              desc
              detail
              category
              attributes
              targets
              selectionCount
              levelAvailable
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    details {
      label
      value
      desc
      __typename
    }
    traits {
      details {
        label
        value
        desc
        __typename
      }
      size
      speeds {
        walking
        swimming
        flying
        climbing
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateRacesMutationVariables,
  APITypes.BatchCreateRacesMutation
>;
export const createFeat = /* GraphQL */ `mutation CreateFeat($input: FeatInput!) {
  createFeat(input: $input) {
    id
    label
    value
    desc
    detail
    category
    ancestry {
      id
      attributes
      origin
      options
      selectionCount
      subtype
      __typename
    }
    attributes
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    primaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    secondaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    bonusDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    charges {
      reset
      limit
      ability
      skill
      usesPerLevel {
        level
        uses
        __typename
      }
      minAmount
      addAmount
      setAmount
      multiplier
      resourcePoints
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    targets
    feats {
      id
      attributes
      feats
      selectionCount
      subtype
      __typename
    }
    modifiers {
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
      dieCount
      dieValue
      dieShort
      feature
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      setPerLevel {
        level
        amount
        __typename
      }
      skills
      saveAbilities
      abilities
      speeds
      charge {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range
      shape
      size
      duration
      unit
      conditions
      damageTypes
      spell
      spellCategory
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    expertise {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    senses {
      id
      attributes
      selectionCount
      subtype
      ids
      __typename
    }
    spells {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    spellcasting {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    prerequisites {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    selectionCount
    levelAvailable
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    options {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateFeatMutationVariables,
  APITypes.CreateFeatMutation
>;
export const updateFeat = /* GraphQL */ `mutation UpdateFeat($input: FeatInput!) {
  updateFeat(input: $input) {
    id
    label
    value
    desc
    detail
    category
    ancestry {
      id
      attributes
      origin
      options
      selectionCount
      subtype
      __typename
    }
    attributes
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    primaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    secondaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    bonusDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    charges {
      reset
      limit
      ability
      skill
      usesPerLevel {
        level
        uses
        __typename
      }
      minAmount
      addAmount
      setAmount
      multiplier
      resourcePoints
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    targets
    feats {
      id
      attributes
      feats
      selectionCount
      subtype
      __typename
    }
    modifiers {
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
      dieCount
      dieValue
      dieShort
      feature
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      setPerLevel {
        level
        amount
        __typename
      }
      skills
      saveAbilities
      abilities
      speeds
      charge {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range
      shape
      size
      duration
      unit
      conditions
      damageTypes
      spell
      spellCategory
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    expertise {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    senses {
      id
      attributes
      selectionCount
      subtype
      ids
      __typename
    }
    spells {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    spellcasting {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    prerequisites {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    selectionCount
    levelAvailable
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    options {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateFeatMutationVariables,
  APITypes.UpdateFeatMutation
>;
export const deleteFeat = /* GraphQL */ `mutation DeleteFeat($id: ID!) {
  deleteFeat(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteFeatMutationVariables,
  APITypes.DeleteFeatMutation
>;
export const batchCreateFeats = /* GraphQL */ `mutation BatchCreateFeats($input: [BatchFeatInput!]!) {
  batchCreateFeats(input: $input) {
    id
    label
    value
    desc
    detail
    category
    ancestry {
      id
      attributes
      origin
      options
      selectionCount
      subtype
      __typename
    }
    attributes
    actions {
      primary {
        id
        amount
        __typename
      }
      secondary {
        id
        amount
        __typename
      }
      __typename
    }
    primaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    secondaryDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    bonusDamage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    charges {
      reset
      limit
      ability
      skill
      usesPerLevel {
        level
        uses
        __typename
      }
      minAmount
      addAmount
      setAmount
      multiplier
      resourcePoints
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    shape {
      id
      size
      unit
      __typename
    }
    targets
    feats {
      id
      attributes
      feats
      selectionCount
      subtype
      __typename
    }
    modifiers {
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
      dieCount
      dieValue
      dieShort
      feature
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      setPerLevel {
        level
        amount
        __typename
      }
      skills
      saveAbilities
      abilities
      speeds
      charge {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range
      shape
      size
      duration
      unit
      conditions
      damageTypes
      spell
      spellCategory
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    expertise {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    senses {
      id
      attributes
      selectionCount
      subtype
      ids
      __typename
    }
    spells {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    spellcasting {
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
        spells
        level
        spellLevel
        __typename
      }
      subtype
      __typename
    }
    prerequisites {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    selectionCount
    levelAvailable
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    options {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateFeatsMutationVariables,
  APITypes.BatchCreateFeatsMutation
>;
export const createEquipment = /* GraphQL */ `mutation CreateEquipment($input: EquipmentInput!) {
  createEquipment(input: $input) {
    id
    label
    value
    desc
    quote
    cost {
      amount
      currency
      __typename
    }
    weight {
      amount
      unit
      __typename
    }
    capacity {
      amount
      unit
      __typename
    }
    maxStack
    quantity
    properties
    category
    equipmentRank
    rarity
    attributes
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    primaryAbility
    secondaryAbility
    optionalAbility
    maxBonus
    armorClass
    prerequisities {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    speed {
      amount
      unit
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    contains {
      equipment
      quantity
      contains {
        equipment
        quantity
        contains {
          equipment
          quantity
          contains {
            equipment
            quantity
            contains {
              equipment
              quantity
              __typename
            }
            currencies {
              id
              value
              label
              desc
              __typename
            }
            __typename
          }
          currencies {
            id
            value
            label
            desc
            conversions {
              copper
              silver
              gold
              electrum
              platinum
              __typename
            }
            __typename
          }
          __typename
        }
        currencies {
          id
          value
          label
          desc
          conversions {
            copper
            silver
            gold
            electrum
            platinum
            __typename
          }
          __typename
        }
        __typename
      }
      currencies {
        id
        value
        label
        desc
        conversions {
          copper
          silver
          gold
          electrum
          platinum
          __typename
        }
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    rank
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateEquipmentMutationVariables,
  APITypes.CreateEquipmentMutation
>;
export const updateEquipment = /* GraphQL */ `mutation UpdateEquipment($input: EquipmentInput!) {
  updateEquipment(input: $input) {
    id
    label
    value
    desc
    quote
    cost {
      amount
      currency
      __typename
    }
    weight {
      amount
      unit
      __typename
    }
    capacity {
      amount
      unit
      __typename
    }
    maxStack
    quantity
    properties
    category
    equipmentRank
    rarity
    attributes
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    primaryAbility
    secondaryAbility
    optionalAbility
    maxBonus
    armorClass
    prerequisities {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    speed {
      amount
      unit
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    contains {
      equipment
      quantity
      contains {
        equipment
        quantity
        contains {
          equipment
          quantity
          contains {
            equipment
            quantity
            contains {
              equipment
              quantity
              __typename
            }
            currencies {
              id
              value
              label
              desc
              __typename
            }
            __typename
          }
          currencies {
            id
            value
            label
            desc
            conversions {
              copper
              silver
              gold
              electrum
              platinum
              __typename
            }
            __typename
          }
          __typename
        }
        currencies {
          id
          value
          label
          desc
          conversions {
            copper
            silver
            gold
            electrum
            platinum
            __typename
          }
          __typename
        }
        __typename
      }
      currencies {
        id
        value
        label
        desc
        conversions {
          copper
          silver
          gold
          electrum
          platinum
          __typename
        }
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    rank
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateEquipmentMutationVariables,
  APITypes.UpdateEquipmentMutation
>;
export const deleteEquipment = /* GraphQL */ `mutation DeleteEquipment($id: ID!) {
  deleteEquipment(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteEquipmentMutationVariables,
  APITypes.DeleteEquipmentMutation
>;
export const batchCreateEquipment = /* GraphQL */ `mutation BatchCreateEquipment($input: [BatchEquipmentInput!]!) {
  batchCreateEquipment(input: $input) {
    id
    label
    value
    desc
    quote
    cost {
      amount
      currency
      __typename
    }
    weight {
      amount
      unit
      __typename
    }
    capacity {
      amount
      unit
      __typename
    }
    maxStack
    quantity
    properties
    category
    equipmentRank
    rarity
    attributes
    damage {
      attributes
      damageSave
      setPerLevel {
        level
        amount
        __typename
      }
      dicePerLevel {
        level
        dieCount
        dieValue
        dieShort
        __typename
      }
      primary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      secondary {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      bonus {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      versatile {
        dieCount
        dieValue
        dieShort
        attribute
        id
        ability
        setAmount
        multiplier
        minAmount
        maxAmount
        pool {
          attribute
          setAmount
          multiplier
          minAmount
          maxAmount
          ability
          option
          __typename
        }
        __typename
      }
      __typename
    }
    saveAbility {
      id
      minAmount
      attributes
      abilityModifier
      __typename
    }
    primaryAbility
    secondaryAbility
    optionalAbility
    maxBonus
    armorClass
    prerequisities {
      options
      skillProficiencies
      equipmentProficiencies {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      equipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      notEquipped {
        numberEquipped
        category
        equipment
        properties
        __typename
      }
      abilityScore {
        abilities
        score
        __typename
      }
      spellsKnown
      featuresKnown
      optionsKnown
      size
      __typename
    }
    speed {
      amount
      unit
      __typename
    }
    range {
      id
      minRange
      maxRange
      distance
      unit
      __typename
    }
    contains {
      equipment
      quantity
      contains {
        equipment
        quantity
        contains {
          equipment
          quantity
          contains {
            equipment
            quantity
            contains {
              equipment
              quantity
              __typename
            }
            currencies {
              id
              value
              label
              desc
              __typename
            }
            __typename
          }
          currencies {
            id
            value
            label
            desc
            conversions {
              copper
              silver
              gold
              electrum
              platinum
              __typename
            }
            __typename
          }
          __typename
        }
        currencies {
          id
          value
          label
          desc
          conversions {
            copper
            silver
            gold
            electrum
            platinum
            __typename
          }
          __typename
        }
        __typename
      }
      currencies {
        id
        value
        label
        desc
        conversions {
          copper
          silver
          gold
          electrum
          platinum
          __typename
        }
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    rank
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateEquipmentMutationVariables,
  APITypes.BatchCreateEquipmentMutation
>;
export const createClass = /* GraphQL */ `mutation CreateClass($input: ClassInput!) {
  createClass(input: $input) {
    id
    label
    value
    desc
    attributes
    category
    details {
      label
      value
      desc
      __typename
    }
    hitpoint {
      ability
      dieCount
      dieValue
      dieShort
      __typename
    }
    startingGold {
      multiplier
      currency
      dieCount
      dieValue
      dieShort
      __typename
    }
    equipment {
      options {
        groups {
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
          __typename
        }
        __typename
      }
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    spellcasting {
      magicName
      ability
      maxSpellLevel
      attributes
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      prepareLimit {
        methods
        level {
          measurement
          rounding
          __typename
        }
        __typename
      }
      __typename
    }
    levelAttributes {
      level
      spellSlots {
        level
        count
        __typename
      }
      resourcePoints
      spellsKnownLimit
      cantripsKnownLimit
      __typename
    }
    resource {
      label
      value
      levelAvailable
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      method
      desc
      __typename
    }
    multiclass {
      primaryAbility {
        id
        minAmount
        __typename
      }
      secondaryAbility {
        id
        minAmount
        __typename
      }
      optionalAbility {
        id
        minAmount
        __typename
      }
      __typename
    }
    parentClass
    subtypes {
      id
      label
      value
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateClassMutationVariables,
  APITypes.CreateClassMutation
>;
export const updateClass = /* GraphQL */ `mutation UpdateClass($input: ClassInput!) {
  updateClass(input: $input) {
    id
    label
    value
    desc
    attributes
    category
    details {
      label
      value
      desc
      __typename
    }
    hitpoint {
      ability
      dieCount
      dieValue
      dieShort
      __typename
    }
    startingGold {
      multiplier
      currency
      dieCount
      dieValue
      dieShort
      __typename
    }
    equipment {
      options {
        groups {
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
          __typename
        }
        __typename
      }
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    spellcasting {
      magicName
      ability
      maxSpellLevel
      attributes
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      prepareLimit {
        methods
        level {
          measurement
          rounding
          __typename
        }
        __typename
      }
      __typename
    }
    levelAttributes {
      level
      spellSlots {
        level
        count
        __typename
      }
      resourcePoints
      spellsKnownLimit
      cantripsKnownLimit
      __typename
    }
    resource {
      label
      value
      levelAvailable
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      method
      desc
      __typename
    }
    multiclass {
      primaryAbility {
        id
        minAmount
        __typename
      }
      secondaryAbility {
        id
        minAmount
        __typename
      }
      optionalAbility {
        id
        minAmount
        __typename
      }
      __typename
    }
    parentClass
    subtypes {
      id
      label
      value
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateClassMutationVariables,
  APITypes.UpdateClassMutation
>;
export const deleteClass = /* GraphQL */ `mutation DeleteClass($id: ID!) {
  deleteClass(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteClassMutationVariables,
  APITypes.DeleteClassMutation
>;
export const batchCreateClasses = /* GraphQL */ `mutation BatchCreateClasses($input: [BatchClassesInput!]!) {
  batchCreateClasses(input: $input) {
    id
    label
    value
    desc
    attributes
    category
    details {
      label
      value
      desc
      __typename
    }
    hitpoint {
      ability
      dieCount
      dieValue
      dieShort
      __typename
    }
    startingGold {
      multiplier
      currency
      dieCount
      dieValue
      dieShort
      __typename
    }
    equipment {
      options {
        groups {
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
          __typename
        }
        __typename
      }
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    spellcasting {
      magicName
      ability
      maxSpellLevel
      attributes
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      prepareLimit {
        methods
        level {
          measurement
          rounding
          __typename
        }
        __typename
      }
      __typename
    }
    levelAttributes {
      level
      spellSlots {
        level
        count
        __typename
      }
      resourcePoints
      spellsKnownLimit
      cantripsKnownLimit
      __typename
    }
    resource {
      label
      value
      levelAvailable
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      method
      desc
      __typename
    }
    multiclass {
      primaryAbility {
        id
        minAmount
        __typename
      }
      secondaryAbility {
        id
        minAmount
        __typename
      }
      optionalAbility {
        id
        minAmount
        __typename
      }
      __typename
    }
    parentClass
    subtypes {
      id
      label
      value
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateClassesMutationVariables,
  APITypes.BatchCreateClassesMutation
>;
export const createCharacter = /* GraphQL */ `mutation CreateCharacter($input: CharacterInput!) {
  createCharacter(input: $input) {
    id
    value
    label
    desc
    advancement
    hitpoint
    abilities {
      manualRolled {
        configuration
        rollGroups {
          rolls {
            score
            ability
            rolling
            applied
            rolled {
              die
              value
              id
              __typename
            }
            kept {
              die
              value
              id
              __typename
            }
            __typename
          }
          __typename
        }
        manual {
          ability
          score
          __typename
        }
        __typename
      }
      pointBuy {
        pointsLeft
        distributed {
          ability
          id
          __typename
        }
        __typename
      }
      standardArray {
        ability
        score
        __typename
      }
      selectedSystem
      scores {
        ability
        baseScore
        raceScore
        classScore
        calculatedScore
        modifierScore
        __typename
      }
      __typename
    }
    race
    ancestry {
      id
      raceId
      lineages
      __typename
    }
    classes {
      id
      subclass {
        id
        subtype
        __typename
      }
      level
      __typename
    }
    spellcasting {
      prepared {
        level
        spells {
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
          __typename
        }
        __typename
      }
      known {
        level
        spells {
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
          __typename
        }
        __typename
      }
      additional {
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
        __typename
      }
      spellSlots {
        level
        used
        classId
        __typename
      }
      __typename
    }
    startingEquipment {
      option
      totalGold
      remainingGold
      __typename
    }
    equipment {
      equipment
      quantity
      contains {
        equipment
        quantity
        contains {
          equipment
          quantity
          contains {
            equipment
            quantity
            contains {
              equipment
              quantity
              __typename
            }
            currencies {
              id
              value
              label
              desc
              __typename
            }
            __typename
          }
          currencies {
            id
            value
            label
            desc
            conversions {
              copper
              silver
              gold
              electrum
              platinum
              __typename
            }
            __typename
          }
          __typename
        }
        currencies {
          id
          value
          label
          desc
          conversions {
            copper
            silver
            gold
            electrum
            platinum
            __typename
          }
          __typename
        }
        __typename
      }
      currencies {
        id
        value
        label
        desc
        conversions {
          copper
          silver
          gold
          electrum
          platinum
          __typename
        }
        __typename
      }
      __typename
    }
    features {
      id
      option
      classId
      raceId
      ancestryId
      equipmentId
      backgroundId
      featId
      optionIndex
      __typename
    }
    feats {
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
      __typename
    }
    proficiencies {
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
      __typename
    }
    expertise {
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
      __typename
    }
    modifiers {
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
      __typename
    }
    senses {
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
      __typename
    }
    ownerId
    systemId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateCharacterMutationVariables,
  APITypes.CreateCharacterMutation
>;
export const updateCharacter = /* GraphQL */ `mutation UpdateCharacter($input: CharacterInput!) {
  updateCharacter(input: $input) {
    id
    value
    label
    desc
    advancement
    hitpoint
    abilities {
      manualRolled {
        configuration
        rollGroups {
          rolls {
            score
            ability
            rolling
            applied
            rolled {
              die
              value
              id
              __typename
            }
            kept {
              die
              value
              id
              __typename
            }
            __typename
          }
          __typename
        }
        manual {
          ability
          score
          __typename
        }
        __typename
      }
      pointBuy {
        pointsLeft
        distributed {
          ability
          id
          __typename
        }
        __typename
      }
      standardArray {
        ability
        score
        __typename
      }
      selectedSystem
      scores {
        ability
        baseScore
        raceScore
        classScore
        calculatedScore
        modifierScore
        __typename
      }
      __typename
    }
    race
    ancestry {
      id
      raceId
      lineages
      __typename
    }
    classes {
      id
      subclass {
        id
        subtype
        __typename
      }
      level
      __typename
    }
    spellcasting {
      prepared {
        level
        spells {
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
          __typename
        }
        __typename
      }
      known {
        level
        spells {
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
          __typename
        }
        __typename
      }
      additional {
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
        __typename
      }
      spellSlots {
        level
        used
        classId
        __typename
      }
      __typename
    }
    startingEquipment {
      option
      totalGold
      remainingGold
      __typename
    }
    equipment {
      equipment
      quantity
      contains {
        equipment
        quantity
        contains {
          equipment
          quantity
          contains {
            equipment
            quantity
            contains {
              equipment
              quantity
              __typename
            }
            currencies {
              id
              value
              label
              desc
              __typename
            }
            __typename
          }
          currencies {
            id
            value
            label
            desc
            conversions {
              copper
              silver
              gold
              electrum
              platinum
              __typename
            }
            __typename
          }
          __typename
        }
        currencies {
          id
          value
          label
          desc
          conversions {
            copper
            silver
            gold
            electrum
            platinum
            __typename
          }
          __typename
        }
        __typename
      }
      currencies {
        id
        value
        label
        desc
        conversions {
          copper
          silver
          gold
          electrum
          platinum
          __typename
        }
        __typename
      }
      __typename
    }
    features {
      id
      option
      classId
      raceId
      ancestryId
      equipmentId
      backgroundId
      featId
      optionIndex
      __typename
    }
    feats {
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
      __typename
    }
    proficiencies {
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
      __typename
    }
    expertise {
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
      __typename
    }
    modifiers {
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
      __typename
    }
    senses {
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
      __typename
    }
    ownerId
    systemId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateCharacterMutationVariables,
  APITypes.UpdateCharacterMutation
>;
export const deleteCharacter = /* GraphQL */ `mutation DeleteCharacter($id: ID!) {
  deleteCharacter(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteCharacterMutationVariables,
  APITypes.DeleteCharacterMutation
>;
export const createBackground = /* GraphQL */ `mutation CreateBackground($input: BackgroundInput!) {
  createBackground(input: $input) {
    id
    label
    value
    desc
    details {
      label
      value
      desc
      __typename
    }
    equipment {
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
      __typename
    }
    currency {
      copper
      silver
      electrum
      gold
      platinum
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateBackgroundMutationVariables,
  APITypes.CreateBackgroundMutation
>;
export const updateBackground = /* GraphQL */ `mutation UpdateBackground($input: BackgroundInput!) {
  updateBackground(input: $input) {
    id
    label
    value
    desc
    details {
      label
      value
      desc
      __typename
    }
    equipment {
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
      __typename
    }
    currency {
      copper
      silver
      electrum
      gold
      platinum
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateBackgroundMutationVariables,
  APITypes.UpdateBackgroundMutation
>;
export const deleteBackground = /* GraphQL */ `mutation DeleteBackground($id: ID!) {
  deleteBackground(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteBackgroundMutationVariables,
  APITypes.DeleteBackgroundMutation
>;
export const batchCreateBackgrounds = /* GraphQL */ `mutation BatchCreateBackgrounds($input: [BatchBackgroundsInput!]!) {
  batchCreateBackgrounds(input: $input) {
    id
    label
    value
    desc
    details {
      label
      value
      desc
      __typename
    }
    equipment {
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
      __typename
    }
    currency {
      copper
      silver
      electrum
      gold
      platinum
      __typename
    }
    proficiencies {
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
        ids
        category
        properties
        __typename
      }
      equipment {
        ids
        category
        properties
        __typename
      }
      __typename
    }
    features {
      id
      label
      value
      desc
      detail
      category
      ancestries {
        id
        attributes
        origin
        options
        selectionCount
        subtype
        __typename
      }
      attributes
      actions {
        primary {
          id
          amount
          __typename
        }
        secondary {
          id
          amount
          __typename
        }
        __typename
      }
      damage {
        attributes
        damageSave
        setPerLevel {
          level
          amount
          __typename
        }
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        primary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        secondary {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        bonus {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        versatile {
          dieCount
          dieValue
          dieShort
          attribute
          id
          ability
          setAmount
          multiplier
          minAmount
          maxAmount
          pool {
            attribute
            setAmount
            multiplier
            minAmount
            maxAmount
            ability
            option
            __typename
          }
          __typename
        }
        __typename
      }
      charges {
        reset
        limit
        ability
        skill
        usesPerLevel {
          level
          uses
          __typename
        }
        minAmount
        addAmount
        setAmount
        multiplier
        resourcePoints
        __typename
      }
      range {
        id
        minRange
        maxRange
        distance
        unit
        __typename
      }
      shape {
        id
        size
        unit
        __typename
      }
      targets
      feats {
        id
        attributes
        feats
        selectionCount
        subtype
        __typename
      }
      modifiers {
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
        dieCount
        dieValue
        dieShort
        feature
        dicePerLevel {
          level
          dieCount
          dieValue
          dieShort
          __typename
        }
        setPerLevel {
          level
          amount
          __typename
        }
        skills
        saveAbilities
        abilities
        speeds
        charge {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range
        shape
        size
        duration
        unit
        conditions
        damageTypes
        spell
        spellCategory
        __typename
      }
      proficiencies {
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
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      expertise {
        id
        subtype
        attributes
        selectionCount
        category
        saveAbilities
        skills
        languages
        properties {
          ids
          category
          properties
          __typename
        }
        equipment {
          ids
          category
          properties
          __typename
        }
        __typename
      }
      senses {
        id
        attributes
        selectionCount
        subtype
        ids
        __typename
      }
      spells {
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
          spells
          level
          spellLevel
          __typename
        }
        subtype
        __typename
      }
      prerequisites {
        options
        skillProficiencies
        equipmentProficiencies {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        equipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        notEquipped {
          numberEquipped
          category
          equipment
          properties
          __typename
        }
        abilityScore {
          abilities
          score
          __typename
        }
        spellsKnown
        featuresKnown
        optionsKnown
        size
        __typename
      }
      saveAbility {
        id
        minAmount
        attributes
        abilityModifier
        __typename
      }
      selectionCount
      levelAvailable
      subfeatures {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        __typename
      }
      options {
        id
        label
        value
        desc
        detail
        category
        ancestries {
          id
          attributes
          origin
          options
          selectionCount
          subtype
          __typename
        }
        attributes
        actions {
          primary {
            id
            amount
            __typename
          }
          secondary {
            id
            amount
            __typename
          }
          __typename
        }
        damage {
          attributes
          damageSave
          setPerLevel {
            level
            amount
            __typename
          }
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          primary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          secondary {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          bonus {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          versatile {
            dieCount
            dieValue
            dieShort
            attribute
            id
            ability
            setAmount
            multiplier
            minAmount
            maxAmount
            pool {
              attribute
              setAmount
              multiplier
              minAmount
              maxAmount
              ability
              option
              __typename
            }
            __typename
          }
          __typename
        }
        charges {
          reset
          limit
          ability
          skill
          usesPerLevel {
            level
            uses
            __typename
          }
          minAmount
          addAmount
          setAmount
          multiplier
          resourcePoints
          __typename
        }
        range {
          id
          minRange
          maxRange
          distance
          unit
          __typename
        }
        shape {
          id
          size
          unit
          __typename
        }
        targets
        feats {
          id
          attributes
          feats
          selectionCount
          subtype
          __typename
        }
        modifiers {
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
          dieCount
          dieValue
          dieShort
          feature
          dicePerLevel {
            level
            dieCount
            dieValue
            dieShort
            __typename
          }
          setPerLevel {
            level
            amount
            __typename
          }
          skills
          saveAbilities
          abilities
          speeds
          charge {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range
          shape
          size
          duration
          unit
          conditions
          damageTypes
          spell
          spellCategory
          __typename
        }
        proficiencies {
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
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        expertise {
          id
          subtype
          attributes
          selectionCount
          category
          saveAbilities
          skills
          languages
          properties {
            ids
            category
            properties
            __typename
          }
          equipment {
            ids
            category
            properties
            __typename
          }
          __typename
        }
        senses {
          id
          attributes
          selectionCount
          subtype
          ids
          __typename
        }
        spells {
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
            spells
            level
            spellLevel
            __typename
          }
          subtype
          __typename
        }
        prerequisites {
          options
          skillProficiencies
          equipmentProficiencies {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          equipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          notEquipped {
            numberEquipped
            category
            equipment
            properties
            __typename
          }
          abilityScore {
            abilities
            score
            __typename
          }
          spellsKnown
          featuresKnown
          optionsKnown
          size
          __typename
        }
        saveAbility {
          id
          minAmount
          attributes
          abilityModifier
          __typename
        }
        selectionCount
        levelAvailable
        subfeatures {
          id
          label
          value
          desc
          detail
          category
          ancestries {
            id
            attributes
            origin
            options
            selectionCount
            subtype
            __typename
          }
          attributes
          actions {
            primary {
              id
              amount
              __typename
            }
            secondary {
              id
              amount
              __typename
            }
            __typename
          }
          damage {
            attributes
            damageSave
            setPerLevel {
              level
              amount
              __typename
            }
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            primary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            secondary {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            bonus {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            versatile {
              dieCount
              dieValue
              dieShort
              attribute
              id
              ability
              setAmount
              multiplier
              minAmount
              maxAmount
              __typename
            }
            __typename
          }
          charges {
            reset
            limit
            ability
            skill
            usesPerLevel {
              level
              uses
              __typename
            }
            minAmount
            addAmount
            setAmount
            multiplier
            resourcePoints
            __typename
          }
          range {
            id
            minRange
            maxRange
            distance
            unit
            __typename
          }
          shape {
            id
            size
            unit
            __typename
          }
          targets
          feats {
            id
            attributes
            feats
            selectionCount
            subtype
            __typename
          }
          modifiers {
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
            dieCount
            dieValue
            dieShort
            feature
            dicePerLevel {
              level
              dieCount
              dieValue
              dieShort
              __typename
            }
            setPerLevel {
              level
              amount
              __typename
            }
            skills
            saveAbilities
            abilities
            speeds
            charge {
              reset
              limit
              ability
              skill
              minAmount
              addAmount
              setAmount
              multiplier
              resourcePoints
              __typename
            }
            range
            shape
            size
            duration
            unit
            conditions
            damageTypes
            spell
            spellCategory
            __typename
          }
          proficiencies {
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
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          expertise {
            id
            subtype
            attributes
            selectionCount
            category
            saveAbilities
            skills
            languages
            properties {
              ids
              category
              properties
              __typename
            }
            equipment {
              ids
              category
              properties
              __typename
            }
            __typename
          }
          senses {
            id
            attributes
            selectionCount
            subtype
            ids
            __typename
          }
          spells {
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
              spells
              level
              spellLevel
              __typename
            }
            subtype
            __typename
          }
          prerequisites {
            options
            skillProficiencies
            equipmentProficiencies {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            equipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            notEquipped {
              numberEquipped
              category
              equipment
              properties
              __typename
            }
            abilityScore {
              abilities
              score
              __typename
            }
            spellsKnown
            featuresKnown
            optionsKnown
            size
            __typename
          }
          saveAbility {
            id
            minAmount
            attributes
            abilityModifier
            __typename
          }
          selectionCount
          levelAvailable
          __typename
        }
        __typename
      }
      __typename
    }
    ownerId
    systemId
    masterId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.BatchCreateBackgroundsMutationVariables,
  APITypes.BatchCreateBackgroundsMutation
>;
