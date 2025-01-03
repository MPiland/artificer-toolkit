/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const listMasterSystems = /* GraphQL */ `query ListMasterSystems {
  listMasterSystems {
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
` as GeneratedQuery<
  APITypes.ListMasterSystemsQueryVariables,
  APITypes.ListMasterSystemsQuery
>;
export const getSystem = /* GraphQL */ `query GetSystem($id: ID!) {
  getSystem(id: $id) {
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
` as GeneratedQuery<APITypes.GetSystemQueryVariables, APITypes.GetSystemQuery>;
export const listSystems = /* GraphQL */ `query ListSystems($limit: Int, $nextToken: String) {
  listSystems(limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListSystemsQueryVariables,
  APITypes.ListSystemsQuery
>;
export const listMasterSpells = /* GraphQL */ `query ListMasterSpells {
  listMasterSpells {
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
` as GeneratedQuery<
  APITypes.ListMasterSpellsQueryVariables,
  APITypes.ListMasterSpellsQuery
>;
export const getSpell = /* GraphQL */ `query GetSpell($id: ID!) {
  getSpell(id: $id) {
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
` as GeneratedQuery<APITypes.GetSpellQueryVariables, APITypes.GetSpellQuery>;
export const listSpells = /* GraphQL */ `query ListSpells($limit: Int, $nextToken: String, $systemId: String!) {
  listSpells(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListSpellsQueryVariables,
  APITypes.ListSpellsQuery
>;
export const listMasterRaces = /* GraphQL */ `query ListMasterRaces {
  listMasterRaces {
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
` as GeneratedQuery<
  APITypes.ListMasterRacesQueryVariables,
  APITypes.ListMasterRacesQuery
>;
export const getRace = /* GraphQL */ `query GetRace($id: ID!) {
  getRace(id: $id) {
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
` as GeneratedQuery<APITypes.GetRaceQueryVariables, APITypes.GetRaceQuery>;
export const listRaces = /* GraphQL */ `query ListRaces($limit: Int, $nextToken: String, $systemId: String!) {
  listRaces(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
            options {
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
          __typename
        }
        __typename
      }
      ownerId
      systemId
      masterId
      __typename
    }
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<APITypes.ListRacesQueryVariables, APITypes.ListRacesQuery>;
export const listMasterFeats = /* GraphQL */ `query ListMasterFeats {
  listMasterFeats {
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
` as GeneratedQuery<
  APITypes.ListMasterFeatsQueryVariables,
  APITypes.ListMasterFeatsQuery
>;
export const getFeat = /* GraphQL */ `query GetFeat($id: ID!) {
  getFeat(id: $id) {
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
` as GeneratedQuery<APITypes.GetFeatQueryVariables, APITypes.GetFeatQuery>;
export const listFeats = /* GraphQL */ `query ListFeats($limit: Int, $nextToken: String, $systemId: String!) {
  listFeats(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
      ownerId
      systemId
      masterId
      __typename
    }
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<APITypes.ListFeatsQueryVariables, APITypes.ListFeatsQuery>;
export const listMasterEquipment = /* GraphQL */ `query ListMasterEquipment {
  listMasterEquipment {
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
` as GeneratedQuery<
  APITypes.ListMasterEquipmentQueryVariables,
  APITypes.ListMasterEquipmentQuery
>;
export const getEquipment = /* GraphQL */ `query GetEquipment($id: ID!) {
  getEquipment(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetEquipmentQueryVariables,
  APITypes.GetEquipmentQuery
>;
export const listEquipment = /* GraphQL */ `query ListEquipment($limit: Int, $nextToken: String, $systemId: String!) {
  listEquipment(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListEquipmentQueryVariables,
  APITypes.ListEquipmentQuery
>;
export const listMasterClasses = /* GraphQL */ `query ListMasterClasses {
  listMasterClasses {
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
` as GeneratedQuery<
  APITypes.ListMasterClassesQueryVariables,
  APITypes.ListMasterClassesQuery
>;
export const getClass = /* GraphQL */ `query GetClass($id: ID!) {
  getClass(id: $id) {
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
` as GeneratedQuery<APITypes.GetClassQueryVariables, APITypes.GetClassQuery>;
export const listClasses = /* GraphQL */ `query ListClasses($limit: Int, $nextToken: String, $systemId: String!) {
  listClasses(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
          __typename
        }
        __typename
      }
      ownerId
      systemId
      masterId
      __typename
    }
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListClassesQueryVariables,
  APITypes.ListClassesQuery
>;
export const getCharacter = /* GraphQL */ `query GetCharacter($id: ID!) {
  getCharacter(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetCharacterQueryVariables,
  APITypes.GetCharacterQuery
>;
export const listCharacters = /* GraphQL */ `query ListCharacters($limit: Int, $nextToken: String, $systemId: String!) {
  listCharacters(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCharactersQueryVariables,
  APITypes.ListCharactersQuery
>;
export const listMasterBackgrounds = /* GraphQL */ `query ListMasterBackgrounds {
  listMasterBackgrounds {
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
` as GeneratedQuery<
  APITypes.ListMasterBackgroundsQueryVariables,
  APITypes.ListMasterBackgroundsQuery
>;
export const getBackground = /* GraphQL */ `query GetBackground($id: ID!) {
  getBackground(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetBackgroundQueryVariables,
  APITypes.GetBackgroundQuery
>;
export const listBackgrounds = /* GraphQL */ `query ListBackgrounds($limit: Int, $nextToken: String, $systemId: String!) {
  listBackgrounds(limit: $limit, nextToken: $nextToken, systemId: $systemId) {
    items {
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
          __typename
        }
        __typename
      }
      ownerId
      systemId
      masterId
      __typename
    }
    nextToken
    message
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListBackgroundsQueryVariables,
  APITypes.ListBackgroundsQuery
>;
