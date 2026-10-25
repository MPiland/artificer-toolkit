import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { abilityModifier } from '@artificer-toolkit/rules-runtime/systems/dnd5e/abilityModifier'
import {
  encounterGmActorDtoSchema,
  type EncounterGmActorDto
} from '@artificer-toolkit/schema/api/encounters'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { tabletopGmEncounter } from '../vtt/CampaignTabletop.stories.fixtures'

const ids = {
  radiant: '00000000-0000-4000-8000-00000000d001',
  bludgeoning: '00000000-0000-4000-8000-00000000d002',
  piercing: '00000000-0000-4000-8000-00000000d003',
  slashing: '00000000-0000-4000-8000-00000000d004',
  psychic: '00000000-0000-4000-8000-00000000d005',
  charmed: '00000000-0000-4000-8000-00000000c001'
}

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useQuery: () => ({
    abilities: [
      { code: 'STRENGTH', label: 'Strength', short: 'STR' },
      { code: 'DEXTERITY', label: 'Dexterity', short: 'DEX' },
      { code: 'CONSTITUTION', label: 'Constitution', short: 'CON' },
      { code: 'INTELLIGENCE', label: 'Intelligence', short: 'INT' },
      { code: 'WISDOM', label: 'Wisdom', short: 'WIS' },
      { code: 'CHARISMA', label: 'Charisma', short: 'CHA' }
    ],
    damageTypes: [
      { id: ids.radiant, code: 'RADIANT', label: 'Radiant' },
      { id: ids.bludgeoning, code: 'BLUDGEONING', label: 'Bludgeoning' },
      { id: ids.piercing, code: 'PIERCING', label: 'Piercing' },
      { id: ids.slashing, code: 'SLASHING', label: 'Slashing' },
      { id: ids.psychic, code: 'PSYCHIC', label: 'Psychic' }
    ],
    conditionTypes: [{ id: ids.charmed, code: 'CHARMED', label: 'Charmed' }],
    senses: [{ id: 'darkvision', label: 'Darkvision' }]
  })
}))

import { EncounterEnemyStatBlock } from './EncounterEnemyStatBlock'

const enemy = tabletopGmEncounter.actors.find((actor) => actor.kind === 'CREATURE')!

function actorWith(statBlock: Partial<NonNullable<EncounterGmActorDto['statBlock']>>) {
  return encounterGmActorDtoSchema.parse({
    ...enemy,
    systemId: SRD_SYSTEM_ID,
    statBlock: {
      armorClass: 19,
      abilityScores: null,
      speeds: [],
      senses: [],
      damageVulnerabilities: [],
      damageResistances: [],
      damageImmunities: [],
      qualifiedDamageDefenses: [],
      conditionImmunities: [],
      ...statBlock
    }
  })
}

describe('EncounterEnemyStatBlock senses', () => {
  it('prints structured Senses with the System label, range and note', () => {
    renderWithAppProviders(
      <EncounterEnemyStatBlock
        actor={actorWith({
          senses: [
            {
              senseDefinitionId: 'darkvision',
              range: { id: 'darkvision-range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
              qualifier: '(blind beyond this radius)'
            }
          ]
        })}
      />
    )
    expect(screen.getByText('darkvision 60 ft (blind beyond this radius)')).toBeInTheDocument()
  })
})

describe('EncounterEnemyStatBlock defenses', () => {
  it('names damage types and shows "from nonmagical attacks" defenses (SRD Couatl)', () => {
    renderWithAppProviders(
      <EncounterEnemyStatBlock
        actor={actorWith({
          damageResistances: [ids.radiant],
          damageImmunities: [ids.psychic],
          qualifiedDamageDefenses: [
            {
              kind: 'IMMUNITY',
              damageTypeIds: [ids.bludgeoning, ids.piercing, ids.slashing],
              bypassedBy: ['MAGICAL']
            }
          ],
          conditionImmunities: [ids.charmed]
        })}
      />
    )
    expect(screen.getByText('Radiant')).toBeInTheDocument()
    expect(
      screen.getByText('Psychic; Bludgeoning, piercing, and slashing from nonmagical attacks')
    ).toBeInTheDocument()
    expect(screen.getByText('Charmed')).toBeInTheDocument()
  })

  it('shows a qualified resistance alone, with a material that bypasses it', () => {
    renderWithAppProviders(
      <EncounterEnemyStatBlock
        actor={actorWith({
          qualifiedDamageDefenses: [
            {
              kind: 'RESISTANCE',
              damageTypeIds: [ids.bludgeoning, ids.piercing, ids.slashing],
              bypassedBy: ['MAGICAL', 'SILVERED']
            }
          ]
        })}
      />
    )
    expect(screen.getByText('Resistant')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Immune')).not.toBeInTheDocument()
  })
})

describe('EncounterEnemyStatBlock ability modifiers', () => {
  it('shows the modifier the shared rules derive, including below 10 and odd scores', () => {
    const scores = {
      STRENGTH: 1,
      DEXTERITY: 9,
      CONSTITUTION: 10,
      INTELLIGENCE: 11,
      WISDOM: 20,
      CHARISMA: 30
    }
    renderWithAppProviders(<EncounterEnemyStatBlock actor={actorWith({ abilityScores: scores })} />)

    for (const [ability, score] of Object.entries(scores)) {
      const modifier = abilityModifier(score)
      const entry = screen.getByText(ability.slice(0, 3)).closest('div')!
      expect(entry).toHaveTextContent(`${score}(${modifier >= 0 ? '+' : ''}${modifier})`)
    }
  })
})
