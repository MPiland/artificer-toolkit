import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useMemo } from 'react'
import { useSelector } from '@tanstack/react-form'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { backgroundAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import {
  absorbElementsSpell,
  srdDamageTypeId
} from '@artificer-toolkit/rules-runtime/testing/absorbElementsSpell'
import { spellAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { paladin } from '@artificer-toolkit/source-data/srd/classes/paladin.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import {
  authoredRouteStoryRecords,
  authoredRouteStorySystem,
  seedStorySystemId,
  seedStoryUserId
} from '#domains/authoredRouteStory.fixtures'
import {
  normalizeFixtureNodeRuntimeValues,
  resolveFixtureNodeRuntime
} from '#test/nodeRuntimeResolver'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { authoredFormFactories } from '../factories/authoredFormFactories'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'
import { AuthoringLayout } from '../layout/AuthoringLayout'
import { FormRenderer } from '../rendering/FormRenderer'
import { isRenderableNode } from '../rendering/FormRenderer.utils'
import { useAppForm } from '../app-form/AppForm'

type BranchScenario = {
  domain: AuthoredFormDomain
  label: string
  record: Record<string, unknown>
}

type ResolvedContext = {
  ancestors: readonly Record<string, unknown>[]
  model: NodeRuntimeResolveResponseDto
  parentValues: Record<string, unknown> | undefined
  values: Record<string, unknown>
}

const SYSTEM_MANAGED_PATH_KEYS = new Set([
  'grantKind',
  'id',
  'kind',
  'order',
  'status',
  'systemId',
  'userId'
])
// Labels and descriptions are display copy (the rich-text control rewrites descriptions as HTML
// on mount) and row ids are generated per record, so neither is part of an effect's structure.
const DISPLAY_COPY_KEYS = new Set(['description', 'label'])
const NON_STRUCTURAL_KEYS = new Set([...DISPLAY_COPY_KEYS, 'id'])
const RAGE_SCENARIO_LABEL = 'class SRD Rage feature'
const SNEAK_ATTACK_SCENARIO_LABEL = 'class SRD Sneak Attack feature'
const SMITE_SCENARIO_LABEL = 'class SRD Divine Smite features'
const smiteFeatures = paladin.features?.filter(({ label }) =>
  ['Divine Smite', 'Improved Divine Smite'].includes(label)
)
const smiteEffects = smiteFeatures?.map(({ effects }) => effects)
const HOLD_PERSON_SCENARIO_LABEL = 'spell SRD Hold Person'
const ABSORB_SCENARIO_LABEL = 'spell user-authored Absorb Elements'

const scenarios = createBranchScenarios()
// One case per resolved context: rendering a whole scenario in a single test made the
// heaviest ones (equipment: 23 contexts) run ~10s alone and time out under CPU load.
const registrationCases = (
  await Promise.all(
    scenarios.map(async (scenario) => {
      const { contexts } = await collectResolvedParity(
        scenario.domain,
        toActualFormValues(scenario.domain, parseScenarioRecord(scenario))
      )
      return contexts.map((context, index) => ({
        context,
        scenarioLabel: scenario.label,
        name: `${scenario.label} registers every visible resolved node of ${context.model.mapId} context ${index} with TanStack Form`
      }))
    })
  )
).flat()
const rageCases = registrationCases.filter(
  ({ scenarioLabel }) => scenarioLabel === RAGE_SCENARIO_LABEL
)
const rageScenario = scenarios.find(({ label }) => label === RAGE_SCENARIO_LABEL)
if (!rageScenario) throw new Error('Expected the SRD Rage class scenario.')
const rageFormValues = toActualFormValues('class', parseScenarioRecord(rageScenario))
const sneakAttackCases = registrationCases.filter(
  ({ scenarioLabel }) => scenarioLabel === SNEAK_ATTACK_SCENARIO_LABEL
)
const sneakAttackScenario = scenarios.find(({ label }) => label === SNEAK_ATTACK_SCENARIO_LABEL)
if (!sneakAttackScenario) throw new Error('Expected the SRD Sneak Attack class scenario.')
const sneakAttackFormValues = toActualFormValues('class', parseScenarioRecord(sneakAttackScenario))
const smiteCases = registrationCases.filter(
  ({ scenarioLabel }) => scenarioLabel === SMITE_SCENARIO_LABEL
)
const smiteScenario = scenarios.find(({ label }) => label === SMITE_SCENARIO_LABEL)
if (!smiteScenario) throw new Error('Expected the SRD Divine Smite class scenario.')
const smiteFormValues = toActualFormValues('class', parseScenarioRecord(smiteScenario))
const holdPersonCases = registrationCases.filter(
  ({ scenarioLabel }) => scenarioLabel === HOLD_PERSON_SCENARIO_LABEL
)
const holdPersonScenario = scenarios.find(({ label }) => label === HOLD_PERSON_SCENARIO_LABEL)
if (!holdPersonScenario) throw new Error('Expected the SRD Hold Person spell scenario.')
const holdPersonFormValues = toActualFormValues('spell', parseScenarioRecord(holdPersonScenario))
const absorbCases = registrationCases.filter(
  ({ scenarioLabel }) => scenarioLabel === ABSORB_SCENARIO_LABEL
)
const absorbScenario = scenarios.find(({ label }) => label === ABSORB_SCENARIO_LABEL)
if (!absorbScenario) throw new Error('Expected the Absorb Elements spell scenario.')
const absorbFormValues = toActualFormValues('spell', parseScenarioRecord(absorbScenario))
const RegistrationRenderer = FormRenderer<Record<string, unknown>>({ defaultValues: {} })

afterEach(cleanup)

describe('authored domain schema, adapter, node, and field parity', () => {
  it('renders spell level zero as the Cantrip numeric select option', async () => {
    const scenario = scenarios.find(({ domain }) => domain === 'spell')
    if (!scenario) throw new Error('Expected the spell authoring scenario.')

    const parsedRecord = parseScenarioRecord(scenario)
    const formValues = { ...toActualFormValues('spell', parsedRecord), level: 0 }
    const rootContext = (await collectResolvedParity('spell', formValues)).contexts.find(
      ({ model }) => model.mapId === 'spell'
    )
    if (!rootContext) throw new Error('Expected the resolved spell root context.')

    render(
      <TestRouterProvider>
        <RegistrationHarness model={rootContext.model} values={formValues} />
      </TestRouterProvider>
    )

    expect(await screen.findByRole('combobox', { name: /^level$/i })).toHaveValue('Cantrip')
    expect(screen.getByRole('textbox', { name: /^name$/i })).toHaveAttribute('maxlength', '120')
    expect(screen.getAllByText(/\/ 20000$/).length).toBeGreaterThan(0)
  }, 10_000)

  it.each(scenarios)(
    '$label exposes every populated authored field through its node tree',
    async (scenario) => {
      const parsedRecord = parseScenarioRecord(scenario)
      const formValues = toActualFormValues(scenario.domain, parsedRecord)
      const { authoredPaths, contexts, systemPaths } = await collectResolvedParity(
        scenario.domain,
        formValues
      )
      const formPaths = collectValueLeafPaths(formValues).filter(
        (path) => !isSystemManagedPath(path) && !systemPaths.has(path)
      )

      expect(contexts.length).toBeGreaterThan(0)
      expect([...formPaths].filter((path) => !authoredPaths.has(path))).toEqual([])
    }
  )

  for (const { context, name } of registrationCases) {
    it(name, async () => {
      await renderUntilRegistered(context.model, context.values)
    })
  }
})

describe('SRD Rage feature effect authoring parity', () => {
  const rageEffects = barbarian.features?.find(({ label }) => label === 'Rage')?.effects

  it('authors the Rage shapes this parity gate is meant to prove', () => {
    const authored = JSON.stringify(rageEffects)
    for (const shape of ['ATTACK_ABILITY', 'SPELLCASTING_LOCK', 'endOnConditionIds', 'holderEnd']) {
      expect(authored).toContain(shape)
    }
  })

  it('keeps every Rage value through node-runtime normalization', async () => {
    const normalized = await normalizeFixtureNodeRuntimeValues({
      mapId: 'class',
      values: rageFormValues
    })

    expect(normalized.clearedPaths).toEqual([])
    expect(normalized.values).toEqual(rageFormValues)
  })

  for (const [index, { context }] of rageCases.entries()) {
    it(`keeps the values of ${context.model.mapId} Rage context ${index} once its field controls mount`, async () => {
      await renderUntilRegistered(context.model, context.values)

      expect(stripKeys(readOutput('form-values'), DISPLAY_COPY_KEYS)).toEqual(
        stripKeys(context.values, DISPLAY_COPY_KEYS)
      )
    })
  }

  it('submits the form values of the Rage class as the SRD Rage effect', async () => {
    const rootContext = rageCases[0]?.context
    if (!rootContext) throw new Error('Expected the resolved Rage class root context.')
    await renderUntilRegistered(rootContext.model, rageFormValues)

    const session = createScenarioSession('class', parseScenarioRecord(rageScenario))
    const submitted = classAuthoringInputDtoSchema.parse(
      session.normalizeForSubmit(readOutput('form-values'))
    )

    expect(stripKeys(submitted.features?.[0]?.effects, NON_STRUCTURAL_KEYS)).toEqual(
      stripKeys(rageEffects, NON_STRUCTURAL_KEYS)
    )
  })
})

describe('SRD Sneak Attack feature effect authoring parity', () => {
  const sneakAttackEffects = rogue.features?.find(({ label }) => label === 'Sneak Attack')?.effects

  it('authors the once-per-turn and gate shapes this parity gate is meant to prove', () => {
    const authored = JSON.stringify(sneakAttackEffects)
    for (const shape of ['"usage":"ONCE_PER_TURN"', 'ENEMY_NEAR_TARGET', 'ATTACK_ROLL_MODE', 'FINESSE']) {
      expect(authored).toContain(shape)
    }
  })

  it('keeps every Sneak Attack value through node-runtime normalization', async () => {
    const normalized = await normalizeFixtureNodeRuntimeValues({
      mapId: 'class',
      values: sneakAttackFormValues
    })

    expect(normalized.clearedPaths).toEqual([])
    expect(normalized.values).toEqual(sneakAttackFormValues)
  })

  for (const [index, { context }] of sneakAttackCases.entries()) {
    it(`keeps the values of ${context.model.mapId} Sneak Attack context ${index} once its field controls mount`, async () => {
      await renderUntilRegistered(context.model, context.values)

      expect(stripKeys(readOutput('form-values'), DISPLAY_COPY_KEYS)).toEqual(
        stripKeys(context.values, DISPLAY_COPY_KEYS)
      )
    })
  }

  it('submits the form values of the Rogue class as the SRD Sneak Attack effects', async () => {
    const rootContext = sneakAttackCases[0]?.context
    if (!rootContext) throw new Error('Expected the resolved Sneak Attack class root context.')
    await renderUntilRegistered(rootContext.model, sneakAttackFormValues)

    const session = createScenarioSession('class', parseScenarioRecord(sneakAttackScenario))
    const submitted = classAuthoringInputDtoSchema.parse(
      session.normalizeForSubmit(readOutput('form-values'))
    )

    expect(stripKeys(submitted.features?.[0]?.effects, NON_STRUCTURAL_KEYS)).toEqual(
      stripKeys(sneakAttackEffects, NON_STRUCTURAL_KEYS)
    )
  })
})

describe('SRD Divine Smite feature effect authoring parity (ADR 0038)', () => {
  it('authors the smite shapes this parity gate is meant to prove', () => {
    const authored = JSON.stringify(smiteEffects)
    for (const shape of ['optionalOnHit', 'SPELL_SLOT', 'restrictions', 'creatureTypeIds']) {
      expect(authored).toContain(shape)
    }
    expect(authored).not.toContain('CLOSED_RULE')
  })

  it('keeps every Divine Smite value through node-runtime normalization', async () => {
    const normalized = await normalizeFixtureNodeRuntimeValues({
      mapId: 'class',
      values: smiteFormValues
    })

    expect(normalized.clearedPaths).toEqual([])
    expect(normalized.values).toEqual(smiteFormValues)
  })

  for (const [index, { context }] of smiteCases.entries()) {
    it(`keeps the values of ${context.model.mapId} Divine Smite context ${index} once its field controls mount`, async () => {
      await renderUntilRegistered(context.model, context.values)

      expect(stripKeys(readOutput('form-values'), DISPLAY_COPY_KEYS)).toEqual(
        stripKeys(context.values, DISPLAY_COPY_KEYS)
      )
    })
  }

  it('submits the form values of the class as the SRD Divine Smite effects', async () => {
    const rootContext = smiteCases[0]?.context
    if (!rootContext) throw new Error('Expected the resolved Divine Smite class root context.')
    await renderUntilRegistered(rootContext.model, smiteFormValues)

    const session = createScenarioSession('class', parseScenarioRecord(smiteScenario))
    const submitted = classAuthoringInputDtoSchema.parse(
      session.normalizeForSubmit(readOutput('form-values'))
    )

    expect(
      stripKeys(
        submitted.features?.map(({ effects }) => effects),
        NON_STRUCTURAL_KEYS
      )
    ).toEqual(stripKeys(smiteEffects, NON_STRUCTURAL_KEYS))
  })
})

describe('SRD Hold Person creature type restriction authoring parity', () => {
  it('authors the creature type restriction this parity gate is meant to prove', () => {
    expect(holdPerson.effects?.[0]?.invocation.targeting).toMatchObject({
      selectionKind: 'SINGLE_TARGET',
      allowedCreatureTypeIds: [expect.any(String)]
    })
  })

  it('keeps the allowed creature types through node-runtime normalization', async () => {
    const normalized = await normalizeFixtureNodeRuntimeValues({
      mapId: 'spell',
      values: holdPersonFormValues
    })

    expect(normalized.clearedPaths).toEqual([])
    expect(normalized.values).toEqual(holdPersonFormValues)
  })

  it('submits the form values of the spell as the SRD Hold Person effect', async () => {
    const rootContext = holdPersonCases.find(
      ({ context }) => context.model.mapId === 'spell'
    )?.context
    if (!rootContext) throw new Error('Expected the resolved Hold Person spell root context.')
    await renderUntilRegistered(rootContext.model, holdPersonFormValues)

    const session = createScenarioSession('spell', parseScenarioRecord(holdPersonScenario))
    const submitted = spellAuthoringInputDtoSchema.parse(
      session.normalizeForSubmit(readOutput('form-values'))
    )

    expect(stripKeys(submitted.effects, NON_STRUCTURAL_KEYS)).toEqual(
      stripKeys(holdPerson.effects, NON_STRUCTURAL_KEYS)
    )
  })
})

describe('user-authored Absorb Elements reaction authoring parity (ADR 0038)', () => {
  const absorbEffects = absorbElementsSpell(['FIRE', 'COLD']).effects
  const resistanceContext = absorbCases
    .map(({ context }) => context)
    .find(({ values }) => isTriggerPayload(values))

  it('authors the reaction shapes this parity gate is meant to prove', () => {
    const authored = JSON.stringify(absorbEffects)
    for (const shape of [
      'DAMAGE_TAKEN',
      'damageTypeSource',
      'SPELL_SLOT_LEVEL',
      'ON_ATTACK_ROLL'
    ]) {
      expect(authored).toContain(shape)
    }
  })

  it('keeps every Absorb Elements value through node-runtime normalization', async () => {
    const normalized = await normalizeFixtureNodeRuntimeValues({
      mapId: 'spell',
      values: absorbFormValues
    })

    expect(normalized.clearedPaths).toEqual([])
    expect(normalized.values).toEqual(absorbFormValues)
  })

  it('shows the triggering-damage option and hides the fixed damage type for the resistance', () => {
    if (!resistanceContext) throw new Error('Expected the resolved resistance modifier context.')
    const fields = getDirectRenderableFieldNames(resistanceContext.model)

    expect(fields).toContain('damageTypeSource')
    expect(fields).not.toContain('damageTypeId')
  })

  it('offers a fixed damage type for a resistance that is not from the trigger', async () => {
    if (!resistanceContext) throw new Error('Expected the resolved resistance modifier context.')
    const model = await resolveFixtureNodeRuntime({
      ancestors: [...resistanceContext.ancestors],
      mapId: resistanceContext.model.mapId,
      parentValues: resistanceContext.parentValues,
      values: { damageTypeId: srdDamageTypeId('FIRE') }
    })

    expect(getDirectRenderableFieldNames(model)).toContain('damageTypeId')
  })

  it('clears a fixed damage type chosen before the triggering damage was', async () => {
    const withBoth = structuredClone(absorbFormValues)
    findRecord(withBoth, isTriggerPayload).damageTypeId = srdDamageTypeId('FIRE')

    const normalized = await normalizeFixtureNodeRuntimeValues({ mapId: 'spell', values: withBoth })
    const kept = findRecord(normalized.values, isTriggerPayload)

    expect(normalized.clearedPaths.length).toBeGreaterThan(0)
    expect(kept.damageTypeSource).toBe('TRIGGER')
    expect(kept.damageTypeId).toBeUndefined()
  })

  for (const [index, { context }] of absorbCases.entries()) {
    it(`keeps the values of ${context.model.mapId} Absorb Elements context ${index} once its field controls mount`, async () => {
      await renderUntilRegistered(context.model, context.values)

      expect(stripKeys(readOutput('form-values'), DISPLAY_COPY_KEYS)).toEqual(
        stripKeys(context.values, DISPLAY_COPY_KEYS)
      )
    })
  }

  it('submits the form values of the spell as the Absorb Elements effect', async () => {
    const rootContext = absorbCases[0]?.context
    if (!rootContext) throw new Error('Expected the resolved Absorb Elements spell root context.')
    await renderUntilRegistered(rootContext.model, absorbFormValues)

    const session = createScenarioSession('spell', parseScenarioRecord(absorbScenario))
    const submitted = spellAuthoringInputDtoSchema.parse(
      session.normalizeForSubmit(readOutput('form-values'))
    )

    expect(stripKeys(submitted.effects, NON_STRUCTURAL_KEYS)).toEqual(
      stripKeys(absorbEffects, NON_STRUCTURAL_KEYS)
    )
  })
})

const isTriggerPayload = ({ damageTypeSource }: Record<string, unknown>) =>
  damageTypeSource === 'TRIGGER'

async function renderUntilRegistered(
  model: NodeRuntimeResolveResponseDto,
  values: Record<string, unknown>
) {
  render(
    <TestRouterProvider>
      <RegistrationHarness model={model} values={values} />
    </TestRouterProvider>
  )

  const expectedFieldNames = getDirectRenderableFieldNames(model)
  await waitFor(() => {
    const registered = new Set<string>(
      JSON.parse(screen.getByTestId('registered-fields').textContent ?? '[]')
    )
    expect(expectedFieldNames.filter((fieldName) => !registered.has(fieldName))).toEqual([])
  })
}

function readOutput(testId: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(screen.getByTestId(testId).textContent ?? 'null')
  if (!isRecord(parsed)) throw new Error(`Expected ${testId} to hold an object.`)
  return parsed
}

function stripKeys(value: unknown, keys: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => stripKeys(item, keys))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !keys.has(key))
      .map(([key, child]) => [key, stripKeys(child, keys)])
  )
}

function RegistrationHarness({
  model,
  values
}: {
  model: NodeRuntimeResolveResponseDto
  values: Record<string, unknown>
}) {
  const defaultValues = useMemo(() => structuredClone(values), [values])
  const form = useAppForm({
    defaultValues,
    onSubmit: async () => undefined
  })
  const registeredFields = useSelector(form.store, (state) => Object.keys(state.fieldMeta).sort())
  const formValues = useSelector(form.store, (state) => state.values)

  return (
    <AuthoringLayout>
      <form.AppForm>
        <RegistrationRenderer
          form={form}
          mapId={model.mapId}
          model={model}
          renderAllSteps
          resolveModel={false}
          updateAuthoringState={false}
        />
        <output data-testid='registered-fields'>{JSON.stringify(registeredFields)}</output>
        <output data-testid='form-values'>{JSON.stringify(formValues)}</output>
      </form.AppForm>
    </AuthoringLayout>
  )
}

function createBranchScenarios(): BranchScenario[] {
  const wizard = authoredRouteStoryRecords.class
  const {
    startingGold: _startingGold,
    startingEquipment: _startingEquipment,
    hitpoint: _hitpoint,
    multiclass: _multiclass,
    ...classCommon
  } = wizard
  const creature = authoredRouteStoryRecords.creature
  const equipment = authoredRouteStoryRecords.equipment
  const dragonborn = authoredRouteStoryRecords.race
  const fireball = authoredRouteStoryRecords.spell

  return [
    { domain: 'background', label: 'background', record: authoredRouteStoryRecords.background },
    { domain: 'class', label: 'class base', record: wizard },
    {
      domain: 'class',
      label: RAGE_SCENARIO_LABEL,
      record: {
        ...wizard,
        id: 'story-rage-class',
        label: 'Rage Test Class',
        attributes: [],
        features: barbarian.features?.filter(({ label }) => label === 'Rage'),
        resources: barbarian.resources
      }
    },
    {
      domain: 'class',
      label: SNEAK_ATTACK_SCENARIO_LABEL,
      record: {
        ...wizard,
        id: 'story-sneak-attack-class',
        label: 'Sneak Attack Test Class',
        attributes: [],
        features: rogue.features?.filter(({ label }) => label === 'Sneak Attack')
      }
    },
    {
      domain: 'class',
      label: SMITE_SCENARIO_LABEL,
      record: {
        ...wizard,
        id: 'story-smite-class',
        label: 'Smite Test Class',
        attributes: [],
        features: smiteFeatures
      }
    },
    {
      domain: 'class',
      label: 'class subclass',
      record: {
        ...classCommon,
        id: 'story-subclass',
        label: 'School of Tests',
        category: 'SUBCLASS',
        parentClassId: wizard.id,
        specializations: [{ id: 'story-specialization', label: 'Test School', order: 1 }]
      }
    },
    {
      domain: 'creature',
      label: 'creature monster',
      record: { ...creature, id: 'story-monster', label: 'Test Monster', category: 'MONSTER' }
    },
    {
      domain: 'creature',
      label: 'creature beast profiles',
      record: {
        ...creature,
        id: 'story-beast',
        label: 'Test Beast',
        category: 'BEAST',
        cost: { amount: 25, currencyId: authoredRouteStorySystem.currencies[0]!.id },
        carryingCapacity: { amount: 300, unit: 'POUNDS' },
        logisticsNotes: ['Requires feed'],
        mountProfile: {
          mountType: 'CONTROLLED',
          capacity: 2,
          riderCount: 1,
          notes: 'Trained mount'
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature npc profile',
      record: {
        ...creature,
        npcProfile: {
          bonds: ['The temple'],
          flaws: ['Too trusting'],
          ideals: ['Charity'],
          personalityTraits: ['Patient']
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature companion profile',
      record: {
        ...creature,
        id: 'story-companion',
        label: 'Test Companion',
        category: 'COMPANION',
        companionProfile: {
          bondType: 'ANIMAL_COMPANION',
          initiativeMode: 'USES_PC_INITIATIVE',
          notes: 'Stays close'
        }
      }
    },
    {
      domain: 'creature',
      label: 'creature summon profile',
      record: {
        ...creature,
        id: 'story-summon',
        label: 'Test Summon',
        category: 'SUMMON',
        companionProfile: {
          bondType: 'SUMMON',
          initiativeMode: 'OWN_INITIATIVE',
          notes: 'Temporary ally'
        }
      }
    },
    { domain: 'equipment', label: 'equipment base', record: equipment },
    {
      domain: 'equipment',
      label: 'equipment stackable',
      record: {
        ...equipment,
        id: 'story-stackable-equipment',
        label: 'Test Ammunition',
        attributes: ['STACKABLE'],
        maxStack: 20
      }
    },
    {
      domain: 'equipment',
      label: 'equipment limited use',
      record: {
        ...equipment,
        id: 'story-limited-equipment',
        label: 'Test Charged Item',
        attributes: ['LIMITED_USE'],
        charges: {
          id: 'story-equipment-charges',
          resetKind: 'MANUAL',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 3,
          bonuses: []
        }
      }
    },
    {
      domain: 'equipment',
      label: 'equipment variant',
      record: {
        kind: 'EQUIPMENT',
        id: 'story-equipment-variant',
        label: 'Test Longsword Variant',
        description: 'A variant used by the authoring parity gate.',
        status: 'ACTIVE',
        rarityId: equipment.rarityId,
        userId: seedStoryUserId,
        systemId: seedStorySystemId,
        category: 'VARIANT',
        parentEquipmentId: equipment.id,
        properties: ['MAGIC'],
        requiresAttunement: true
      }
    },
    { domain: 'feat', label: 'feat', record: authoredRouteStoryRecords.feat },
    {
      domain: 'race',
      label: 'race base ancestry',
      record: {
        ...dragonborn,
        ancestry: {
          id: 'story-ancestry',
          label: 'Draconic Ancestry',
          description: 'Choose a draconic ancestor.',
          options: [
            {
              id: 'story-ancestry-red',
              label: 'Red Dragon',
              description: 'Fire ancestry.',
              order: 1,
              features: dragonborn.features
            }
          ]
        }
      }
    },
    {
      domain: 'race',
      label: 'race subrace',
      record: {
        id: 'story-subrace',
        label: 'Test Subrace',
        description: 'A subrace used by the authoring parity gate.',
        status: 'ACTIVE',
        category: 'SUBRACE',
        parentRaceId: dragonborn.id,
        details: dragonborn.details,
        features: dragonborn.features,
        userId: seedStoryUserId,
        systemId: seedStorySystemId
      }
    },
    { domain: 'spell', label: 'spell material and deep effects', record: fireball },
    {
      domain: 'spell',
      label: HOLD_PERSON_SCENARIO_LABEL,
      record: {
        ...fireball,
        id: 'story-hold-person',
        label: 'Hold Person Test Spell',
        effects: holdPerson.effects
      }
    },
    {
      domain: 'spell',
      label: ABSORB_SCENARIO_LABEL,
      record: {
        ...fireball,
        id: 'story-absorb-elements',
        label: 'Test Absorb Elements',
        effects: absorbElementsSpell(['FIRE', 'COLD']).effects
      }
    },
    {
      domain: 'spell',
      label: 'spell without material',
      record: {
        ...fireball,
        id: 'story-spell-no-material',
        label: 'Test Cantrip',
        components: ['VERBAL', 'SOMATIC'],
        materialDescription: undefined,
        effects: []
      }
    },
    { domain: 'vehicle', label: 'vehicle', record: authoredRouteStoryRecords.vehicle }
  ]
}

function parseScenarioRecord({ domain, record }: BranchScenario): Record<string, unknown> {
  switch (domain) {
    case 'background':
      return backgroundAuthoringInputDtoSchema.parse(record)
    case 'class':
      return classAuthoringInputDtoSchema.parse(record)
    case 'creature':
      return creatureAuthoringInputDtoSchema.parse(record)
    case 'equipment':
      return equipmentAuthoringInputDtoSchema.parse(record)
    case 'feat':
      return featAuthoringInputDtoSchema.parse(record)
    case 'race':
      return raceAuthoringInputDtoSchema.parse(record)
    case 'spell':
      return spellAuthoringInputDtoSchema.parse(record)
    case 'vehicle':
      return vehicleAuthoringInputDtoSchema.parse(record)
  }
}

function createScenarioSession(domain: AuthoredFormDomain, record: Record<string, unknown>) {
  const session = authoredFormFactories[domain].createSession?.({
    data: {
      draft: null,
      response: {
        item: record,
        permissions: { canCopy: true, canDelete: true, canEdit: true }
      },
      subjectId: String(record.id),
      system: authoredRouteStorySystem
    },
    mode: 'edit'
  })

  expect(session).toBeDefined()
  return session!
}

function toActualFormValues(
  domain: AuthoredFormDomain,
  record: Record<string, unknown>
): Record<string, unknown> {
  return createScenarioSession(domain, record).initialValues as Record<string, unknown>
}

async function collectResolvedParity(mapId: string, values: Record<string, unknown>) {
  const authoredPaths = new Set<string>()
  const systemPaths = new Set<string>()
  const contexts: ResolvedContext[] = []

  await collectResolvedContext({
    ancestors: [],
    authoredPaths,
    systemPaths,
    contexts,
    mapId,
    parentValues: undefined,
    pathPrefix: [],
    values
  })

  return { authoredPaths, contexts, systemPaths }
}

async function collectResolvedContext({
  ancestors,
  authoredPaths,
  systemPaths,
  contexts,
  mapId,
  parentValues,
  pathPrefix,
  values
}: {
  ancestors: readonly Record<string, unknown>[]
  authoredPaths: Set<string>
  systemPaths: Set<string>
  contexts: ResolvedContext[]
  mapId: string
  parentValues?: Record<string, unknown>
  pathPrefix: readonly (string | number)[]
  values: Record<string, unknown>
}) {
  const model = await resolveFixtureNodeRuntime({
    ancestors: [...ancestors],
    mapId,
    parentValues,
    values
  })

  contexts.push({ ancestors, model, parentValues, values })

  for (const node of model.steps.flatMap((step) =>
    step.sections.flatMap((section) => section.nodes)
  )) {
    const localPath = [...node.path]
    const completePath = [...pathPrefix, ...localPath]
    if (node.authoring?.exposure === 'system') {
      systemPaths.add(normalizePath(completePath))
      continue
    }
    if (!isRenderableNode(node)) continue

    if (node.kind === 'INPUT') {
      authoredPaths.add(normalizePath(completePath))
      continue
    }

    if (!node.childMapId) continue
    const childValue = readPath(values, localPath)
    if (Array.isArray(childValue)) {
      for (const [index, row] of childValue.entries()) {
        if (!isRecord(row)) continue
        await collectResolvedContext({
          ancestors: [values, ...ancestors],
          authoredPaths,
          systemPaths,
          contexts,
          mapId: node.childMapId,
          parentValues: values,
          pathPrefix: [...completePath, index],
          values: row
        })
      }
      continue
    }

    if (isRecord(childValue)) {
      await collectResolvedContext({
        ancestors: [values, ...ancestors],
        authoredPaths,
        systemPaths,
        contexts,
        mapId: node.childMapId,
        parentValues: values,
        pathPrefix: completePath,
        values: childValue
      })
    }
  }
}

function collectValueLeafPaths(value: unknown, path: readonly (string | number)[] = []): string[] {
  if (value === undefined) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (value.every((item) => !isRecord(item) && !Array.isArray(item))) {
      return [normalizePath(path)]
    }
    return value.flatMap((item, index) => collectValueLeafPaths(item, [...path, index]))
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectValueLeafPaths(child, [...path, key])
    )
  }
  return path.length > 0 ? [normalizePath(path)] : []
}

function getDirectRenderableFieldNames(model: NodeRuntimeResolveResponseDto) {
  return model.steps
    .flatMap((step) => step.sections.flatMap((section) => section.nodes))
    .filter(isRenderableNode)
    .map((node) => node.path.join('.'))
}

/** The first record anywhere under `value` that satisfies `matches`. */
function findRecord(
  value: unknown,
  matches: (record: Record<string, unknown>) => boolean
): Record<string, unknown> {
  const found = searchRecord(value, matches)
  if (!found) throw new Error('Expected a matching record in the form values.')
  return found
}

function searchRecord(
  value: unknown,
  matches: (record: Record<string, unknown>) => boolean
): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = searchRecord(item, matches)
      if (found) return found
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  if (matches(value)) return value
  for (const child of Object.values(value)) {
    const found = searchRecord(child, matches)
    if (found) return found
  }
  return undefined
}

function readPath(values: Record<string, unknown>, path: readonly (string | number)[]) {
  let current: unknown = values
  for (const segment of path) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    current = current[segment as keyof typeof current]
  }
  return current
}

function normalizePath(path: readonly (string | number)[]) {
  return path.map((segment) => (typeof segment === 'number' ? '[]' : segment)).join('.')
}

function isSystemManagedPath(path: string) {
  const finalKey = path.split('.').at(-1)
  return finalKey !== undefined && SYSTEM_MANAGED_PATH_KEYS.has(finalKey)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
