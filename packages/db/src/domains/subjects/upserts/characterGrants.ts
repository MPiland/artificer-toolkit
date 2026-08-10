import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { assertNever } from '../../../utils/index.js'

type CharacterFeatureSelectionValue = NonNullable<
  NonNullable<
    CharacterAuthored['intent']['featureAcquisitions'][number]['selections']
  >[number]['values']
>[number]

export function serializeSelectionValue(value: CharacterFeatureSelectionValue) {
  switch (value.kind) {
    case 'ID':
      return {
        value_kind: 'ID',
        text_value: value.id,
        number_value: null,
        boolean_value: null
      }

    case 'IDS':
      return {
        value_kind: 'IDS',
        text_value: JSON.stringify(value.ids),
        number_value: null,
        boolean_value: null
      }

    case 'NUMBER':
      return {
        value_kind: 'NUMBER',
        text_value: null,
        number_value: value.value,
        boolean_value: null
      }

    case 'BOOLEAN':
      return {
        value_kind: 'BOOLEAN',
        text_value: null,
        number_value: null,
        boolean_value: value.value
      }

    default:
      return assertNever(value)
  }
}

export function mapTiming(
  timing: CharacterAuthored['intent']['featureAcquisitions'][number]['timing']
) {
  switch (timing.kind) {
    case 'IMMEDIATE':
      return {
        timing_kind: 'IMMEDIATE',
        timing_level: null,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CHARACTER_LEVEL':
      return {
        timing_kind: 'CHARACTER_LEVEL',
        timing_level: timing.level,
        timing_class_id: null,
        timing_class_level: null
      }

    case 'CLASS_LEVEL':
      return {
        timing_kind: 'CLASS_LEVEL',
        timing_level: null,
        timing_class_id: timing.classId,
        timing_class_level: timing.classLevel
      }

    default:
      return assertNever(timing)
  }
}

export function mapFeatureSource(
  source: CharacterAuthored['intent']['featureAcquisitions'][number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'RACE':
      return {
        source_kind: 'RACE',
        class_id: null,
        subclass_id: null,
        race_id: source.raceId,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'SUBRACE':
      return {
        source_kind: 'SUBRACE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: source.subraceId,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'ANCESTRY':
      return {
        source_kind: 'ANCESTRY',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: source.ancestryId,
        option_id: source.optionId,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'BACKGROUND':
      return {
        source_kind: 'BACKGROUND',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: source.backgroundId,
        feat_id: null,
        reason: null
      }

    case 'FEAT':
      return {
        source_kind: 'FEAT',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: source.featId,
        reason: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId,
        background_id: null,
        feat_id: null,
        reason: null
      }

    case 'MANUAL':
      return {
        source_kind: 'MANUAL',
        class_id: null,
        subclass_id: null,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        reason: source.reason ?? null
      }

    default:
      return assertNever(source)
  }
}

export function mapChosenGrantSelectionSource(
  source: NonNullable<CharacterAuthored['intent']['chosenGrantSelections']>[number]['source']
) {
  const emptyReferences = {
    class_id: null,
    subclass_id: null,
    source_class_level: null,
    race_id: null,
    subrace_id: null,
    ancestry_id: null,
    option_id: null,
    acquired_parent_id: null,
    background_id: null,
    feat_id: null,
    feature_id: null,
    reason: null
  }

  switch (source.kind) {
    case 'CLASS':
      return {
        ...emptyReferences,
        source_kind: 'CLASS',
        class_id: source.classId,
        source_class_level: source.classLevel ?? null
      }
    case 'SUBCLASS':
      return {
        ...emptyReferences,
        source_kind: 'SUBCLASS',
        subclass_id: source.subclassId,
        source_class_level: source.classLevel ?? null
      }
    case 'RACE':
      return {
        ...emptyReferences,
        source_kind: 'RACE',
        race_id: source.raceId
      }
    case 'SUBRACE':
      return {
        ...emptyReferences,
        source_kind: 'SUBRACE',
        subrace_id: source.subraceId
      }
    case 'ANCESTRY':
      return {
        ...emptyReferences,
        source_kind: 'ANCESTRY',
        ancestry_id: source.ancestryId,
        option_id: source.optionId
      }
    case 'BACKGROUND':
      return {
        ...emptyReferences,
        source_kind: 'BACKGROUND',
        background_id: source.backgroundId
      }
    case 'FEAT':
      return {
        ...emptyReferences,
        source_kind: 'FEAT',
        feat_id: source.featId
      }
    case 'FEATURE':
      return {
        ...emptyReferences,
        source_kind: 'FEATURE',
        feature_id: source.featureId
      }
    case 'OPTION':
      return {
        ...emptyReferences,
        source_kind: 'OPTION',
        acquired_parent_id: source.acquiredParentId,
        option_id: source.optionId
      }
    case 'MANUAL':
      return {
        ...emptyReferences,
        source_kind: 'MANUAL',
        reason: source.reason ?? null
      }
    default:
      return assertNever(source)
  }
}

export function mapSpellSelectionSource(
  source: NonNullable<CharacterAuthored['intent']['spellSelections']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}

export function mapResourceGrantSource(
  source: NonNullable<CharacterAuthored['intent']['resourceGrants']>[number]['source']
) {
  switch (source.kind) {
    case 'CLASS':
      return {
        source_kind: 'CLASS',
        class_id: source.classId,
        subclass_id: null,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'SUBCLASS':
      return {
        source_kind: 'SUBCLASS',
        class_id: null,
        subclass_id: source.subclassId,
        feature_id: null,
        option_id: null,
        acquired_parent_id: null
      }

    case 'FEATURE':
      return {
        source_kind: 'FEATURE',
        class_id: null,
        subclass_id: null,
        feature_id: source.featureId,
        option_id: null,
        acquired_parent_id: null
      }

    case 'OPTION':
      return {
        source_kind: 'OPTION',
        class_id: null,
        subclass_id: null,
        feature_id: null,
        option_id: source.optionId,
        acquired_parent_id: source.acquiredParentId
      }

    default:
      return assertNever(source)
  }
}
