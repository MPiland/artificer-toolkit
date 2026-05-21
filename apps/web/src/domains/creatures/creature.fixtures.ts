import type {
  CreatureListResponseDto,
  CreatureResponseDto,
  NodeRuntimeResolveResponseDto
} from '#app/lib/api'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'

export const ownedMonsterFixture: CreatureAuthoredDto = {
  id: 'owned-owlbear',
  label: 'Moonlit Owlbear',
  description: 'A territorial owlbear with pale feathers and a thunderous warning cry.',
  quote: 'The trees go quiet before it charges.',
  status: 'ACTIVE',
  recordKind: 'STAT_BLOCK',
  category: 'MONSTER',
  creatureTypeId: 'monstrosity',
  size: 'LARGE',
  alignmentId: 'unaligned',
  tags: ['forest', 'ambush'],
  userId: 'user-1',
  systemId: 'dnd-5e-srd',
  abilityScores: {
    STRENGTH: 20,
    DEXTERITY: 12,
    CONSTITUTION: 17,
    INTELLIGENCE: 3,
    WISDOM: 12,
    CHARISMA: 7,
    SPELLCASTING: 0
  },
  armorClass: 13,
  hitPoints: 68,
  hitDice: '7d10 + 21',
  speeds: [{ speedId: 'walk', amount: 40, unit: 'FEET' }],
  senses: ['darkvision 60 ft.'],
  passivePerception: 13,
  challengeRatingId: 'cr-3',
  xp: 700,
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  conditionImmunities: [],
  actions: [
    {
      id: 'beak',
      label: 'Beak',
      description: 'Melee weapon attack against one target.',
      attackBonus: 7,
      damage: '1d10 + 5 piercing'
    }
  ],
  bonusActions: [],
  reactions: [],
  details: [],
  features: [],
  proficiencies: [],
  legendaryProfile: {
    actionsCount: 2,
    legendaryResistanceCount: 1
  },
  lairProfile: {
    regionalEffects: ['Owls refuse to nest within a mile of the den.']
  }
}

export const beastMountFixture: CreatureAuthoredDto = {
  ...ownedMonsterFixture,
  id: 'owned-river-hart',
  label: 'River Hart',
  description: 'A sure-footed stag trained to carry riders across shallow riverbeds.',
  category: 'BEAST',
  creatureTypeId: 'beast',
  size: 'LARGE',
  tags: ['mount', 'travel'],
  challengeRatingId: 'cr-1-4',
  actions: [],
  legendaryProfile: undefined,
  lairProfile: undefined,
  cost: {
    amount: 75,
    currencyId: 'gold'
  },
  carryingCapacity: {
    amount: 480,
    unit: 'POUNDS'
  },
  logisticsNotes: ['Advantage on checks to cross shallow running water.'],
  mountProfile: {
    mountType: 'CONTROLLED',
    riderCount: 1,
    notes: 'Trained for a single rider and saddlebags.'
  }
}

export const npcFixture: CreatureAuthoredDto = {
  ...ownedMonsterFixture,
  id: 'owned-sable-informant',
  label: 'Sable Informant',
  description: 'A careful tavern broker who knows which rumors are safe to sell.',
  category: 'NPC',
  creatureTypeId: 'humanoid',
  size: 'MEDIUM',
  tags: ['social', 'urban'],
  legendaryProfile: undefined,
  lairProfile: undefined,
  npcProfile: {
    personalityTraits: ['Never names a source.'],
    ideals: ['Information keeps people alive.'],
    bonds: ['Protects the tavern staff.'],
    flaws: ['Overplays every negotiation.']
  }
}

export const companionFixture: CreatureAuthoredDto = {
  ...ownedMonsterFixture,
  id: 'owned-ashwing-familiar',
  label: 'Ashwing Familiar',
  description: 'A soot-feathered companion that curls near warm lantern glass between watches.',
  category: 'COMPANION',
  creatureTypeId: 'beast',
  size: 'TINY',
  tags: ['familiar', 'scout'],
  legendaryProfile: undefined,
  lairProfile: undefined,
  companionProfile: {
    bondType: 'FAMILIAR',
    initiativeMode: 'USES_PC_INITIATIVE',
    notes: 'Shares danger cues with its bonded character.'
  }
}

export const summonFixture: CreatureAuthoredDto = {
  ...ownedMonsterFixture,
  id: 'owned-cinder-sentinel',
  label: 'Cinder Sentinel',
  description: 'A temporary guardian shaped from ember and old battlefield ash.',
  category: 'SUMMON',
  creatureTypeId: 'elemental',
  size: 'MEDIUM',
  tags: ['summon', 'guardian'],
  legendaryProfile: undefined,
  lairProfile: undefined,
  companionProfile: {
    bondType: 'SUMMON',
    initiativeMode: 'USES_PC_INITIATIVE',
    notes: 'Fades when the summoning effect ends.'
  }
}

export const ownedCreatureResponseFixture: NonNullable<CreatureResponseDto> = {
  publicId: ownedMonsterFixture.id,
  item: ownedMonsterFixture,
  provenance: {
    kind: 'OWNED',
    ownerUserId: 'user-1'
  },
  permissions: {
    canView: true,
    canEdit: true,
    canCopy: true,
    canDelete: true
  }
}

export const masterCreatureResponseFixture: NonNullable<CreatureResponseDto> = {
  publicId: 'master-owlbear',
  item: {
    ...ownedMonsterFixture,
    id: 'master-owlbear',
    label: 'Owlbear',
    userId: 'master'
  },
  provenance: {
    kind: 'MASTER',
    ownerUserId: null
  },
  permissions: {
    canView: true,
    canEdit: false,
    canCopy: true,
    canDelete: false
  }
}

export const creatureListResponseFixture: CreatureListResponseDto = {
  items: [
    {
      id: ownedMonsterFixture.id,
      publicId: ownedMonsterFixture.id,
      label: ownedMonsterFixture.label,
      description: ownedMonsterFixture.description,
      status: 'ACTIVE',
      systemId: ownedMonsterFixture.systemId,
      userId: ownedMonsterFixture.userId,
      category: ownedMonsterFixture.category,
      provenance: ownedCreatureResponseFixture.provenance,
      permissions: ownedCreatureResponseFixture.permissions
    },
    {
      id: beastMountFixture.id,
      publicId: beastMountFixture.id,
      label: beastMountFixture.label,
      description: beastMountFixture.description,
      status: 'DRAFT',
      systemId: beastMountFixture.systemId,
      userId: beastMountFixture.userId,
      category: beastMountFixture.category,
      provenance: ownedCreatureResponseFixture.provenance,
      permissions: ownedCreatureResponseFixture.permissions,
      draft: {
        subjectKind: 'CREATURE',
        subjectId: beastMountFixture.id,
        publicId: beastMountFixture.id,
        userId: beastMountFixture.userId,
        systemId: beastMountFixture.systemId,
        label: beastMountFixture.label,
        status: 'DRAFT',
        draftState: 'DRAFT_ONLY'
      }
    },
    {
      id: npcFixture.id,
      publicId: npcFixture.id,
      label: npcFixture.label,
      description: npcFixture.description,
      status: 'ACTIVE',
      systemId: npcFixture.systemId,
      userId: npcFixture.userId,
      category: npcFixture.category,
      provenance: ownedCreatureResponseFixture.provenance,
      permissions: ownedCreatureResponseFixture.permissions
    },
    {
      id: companionFixture.id,
      publicId: companionFixture.id,
      label: companionFixture.label,
      description: companionFixture.description,
      status: 'ACTIVE',
      systemId: companionFixture.systemId,
      userId: companionFixture.userId,
      category: companionFixture.category,
      provenance: ownedCreatureResponseFixture.provenance,
      permissions: ownedCreatureResponseFixture.permissions
    },
    {
      id: summonFixture.id,
      publicId: summonFixture.id,
      label: summonFixture.label,
      description: summonFixture.description,
      status: 'ACTIVE',
      systemId: summonFixture.systemId,
      userId: summonFixture.userId,
      category: summonFixture.category,
      provenance: ownedCreatureResponseFixture.provenance,
      permissions: ownedCreatureResponseFixture.permissions
    },
    {
      id: masterCreatureResponseFixture.item!.id,
      publicId: masterCreatureResponseFixture.publicId,
      label: masterCreatureResponseFixture.item!.label,
      description: masterCreatureResponseFixture.item!.description,
      status: 'ACTIVE',
      systemId: masterCreatureResponseFixture.item!.systemId,
      userId: 'master',
      category: masterCreatureResponseFixture.item!.category,
      provenance: masterCreatureResponseFixture.provenance,
      permissions: masterCreatureResponseFixture.permissions
    }
  ],
  drafts: [],
  meta: {}
}

export const creatureRuntimeFixture: NodeRuntimeResolveResponseDto = {
  mapId: 'creature',
  clearPaths: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 10,
      sections: [
        {
          id: 'basics',
          label: 'Basics',
          order: 10,
          nodes: [
            selectNode('category', ['category'], 'Category', [
              { value: 'MONSTER', label: 'Monster' },
              { value: 'BEAST', label: 'Beast' },
              { value: 'NPC', label: 'NPC' },
              { value: 'COMPANION', label: 'Companion' },
              { value: 'SUMMON', label: 'Summon' }
            ], true),
            selectNode('creatureTypeId', ['creatureTypeId'], 'Creature Type', [
              { value: 'beast', label: 'Beast' },
              { value: 'humanoid', label: 'Humanoid' },
              { value: 'monstrosity', label: 'Monstrosity' }
            ], true),
            selectNode('alignmentId', ['alignmentId'], 'Alignment', [
              { value: 'unaligned', label: 'Unaligned' },
              { value: 'neutral', label: 'Neutral' }
            ], false)
          ]
        }
      ]
    },
    {
      id: 'stats',
      label: 'Stats',
      order: 20,
      sections: [
        {
          id: 'stats',
          label: 'Stats',
          order: 20,
          nodes: [
            selectNode('speedId', ['speeds', 'speedId'], 'Speed', [
              { value: 'walk', label: 'Walk' },
              { value: 'swim', label: 'Swim' },
              { value: 'fly', label: 'Fly' }
            ], false)
          ]
        }
      ]
    },
    {
      id: 'defenses',
      label: 'Defenses',
      order: 30,
      sections: [
        {
          id: 'defenses',
          label: 'Defenses',
          order: 30,
          nodes: [
            selectNode('challengeRatingId', ['challengeRatingId'], 'Challenge Rating', [
              { value: 'cr-1-4', label: '1/4' },
              { value: 'cr-3', label: '3' }
            ], false),
            selectNode('damageVulnerabilities', ['damageVulnerabilities'], 'Damage Vulnerabilities', [
              { value: 'fire', label: 'Fire' },
              { value: 'cold', label: 'Cold' }
            ], false, 'SELECT_MULTI'),
            selectNode('damageResistances', ['damageResistances'], 'Damage Resistances', [
              { value: 'fire', label: 'Fire' },
              { value: 'cold', label: 'Cold' }
            ], false, 'SELECT_MULTI'),
            selectNode('damageImmunities', ['damageImmunities'], 'Damage Immunities', [{ value: 'poison', label: 'Poison' }], false, 'SELECT_MULTI'),
            selectNode('conditionImmunities', ['conditionImmunities'], 'Condition Immunities', [
              { value: 'charmed', label: 'Charmed' },
              { value: 'poisoned', label: 'Poisoned' }
            ], false)
          ]
        }
      ]
    },
    {
      id: 'profiles',
      label: 'Profiles',
      order: 60,
      sections: [
        {
          id: 'profiles',
          label: 'Profiles',
          order: 60,
          nodes: [
            selectNode('currencyId', ['cost', 'currencyId'], 'Currency', [
              { value: 'gold', label: 'Gold' },
              { value: 'silver', label: 'Silver' }
            ], false)
          ]
        }
      ]
    }
  ]
}

function selectNode(
  id: string,
  path: string[],
  label: string,
  options: Array<{ value: string, label: string }>,
  required: boolean,
  type: 'SELECT_SINGLE' | 'SELECT_MULTI' = 'SELECT_SINGLE'
): NodeRuntimeResolveResponseDto['steps'][number]['sections'][number]['nodes'][number] {
  return {
    id,
    path,
    label,
    kind: 'INPUT',
    type,
    visible: true,
    required,
    clearPaths: [],
    options
  }
}
