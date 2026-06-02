export type AuthoringCoverageMode = 'editable' | 'readonly'

export type AuthoringCoverageStory = {
  exportName: string
  id: string
  mode: AuthoringCoverageMode
}

export type AuthoringCoverageDomain = {
  domain: string
  storyFile: string
  title: string
  stories: readonly AuthoringCoverageStory[]
}

export const authoredFormCoverage = [
  {
    domain: 'backgrounds',
    storyFile: 'src/domains/backgrounds/stories/BackgroundAuthoring.stories.tsx',
    title: 'Domains/Backgrounds/Authoring',
    stories: [
      { exportName: 'Create', id: 'domains-backgrounds-authoring--create', mode: 'editable' },
      { exportName: 'EditOwned', id: 'domains-backgrounds-authoring--edit-owned', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-backgrounds-authoring--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'classes',
    storyFile: 'src/domains/classes/stories/ClassForm.stories.tsx',
    title: 'Domains/Classes/Form',
    stories: [
      { exportName: 'EditBaseClass', id: 'domains-classes-form--edit-base-class', mode: 'editable' },
      { exportName: 'CreateDraft', id: 'domains-classes-form--create-draft', mode: 'editable' },
      { exportName: 'EditSubclass', id: 'domains-classes-form--edit-subclass', mode: 'editable' },
      { exportName: 'LockedSubclass', id: 'domains-classes-form--locked-subclass', mode: 'readonly' },
      { exportName: 'InvalidDraftRecovery', id: 'domains-classes-form--invalid-draft-recovery', mode: 'editable' }
    ]
  },
  {
    domain: 'creatures',
    storyFile: 'src/domains/creatures/stories/CreatureAuthoring.stories.tsx',
    title: 'Domains/Creatures/Authoring',
    stories: [
      { exportName: 'CreateMonster', id: 'domains-creatures-authoring--create-monster', mode: 'editable' },
      { exportName: 'EditMonster', id: 'domains-creatures-authoring--edit-monster', mode: 'editable' },
      { exportName: 'BeastMount', id: 'domains-creatures-authoring--beast-mount', mode: 'editable' },
      { exportName: 'NpcPersonality', id: 'domains-creatures-authoring--npc-personality', mode: 'editable' },
      { exportName: 'CompanionProfile', id: 'domains-creatures-authoring--companion-profile', mode: 'editable' },
      { exportName: 'SummonProfile', id: 'domains-creatures-authoring--summon-profile', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-creatures-authoring--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'equipment',
    storyFile: 'src/domains/equipment/stories/EquipmentForm.stories.tsx',
    title: 'Domains/Equipment/Form',
    stories: [
      { exportName: 'CreateBaseEquipment', id: 'domains-equipment-form--create-base-equipment', mode: 'editable' },
      { exportName: 'EditBaseEquipment', id: 'domains-equipment-form--edit-base-equipment', mode: 'editable' },
      { exportName: 'EditVariantEquipment', id: 'domains-equipment-form--edit-variant-equipment', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-equipment-form--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'feats',
    storyFile: 'src/domains/feats/stories/FeatAuthoring.stories.tsx',
    title: 'Domains/Feats/Authoring',
    stories: [
      { exportName: 'Create', id: 'domains-feats-authoring--create', mode: 'editable' },
      { exportName: 'EditOwned', id: 'domains-feats-authoring--edit-owned', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-feats-authoring--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'races',
    storyFile: 'src/domains/races/stories/RaceAuthoring.stories.tsx',
    title: 'Domains/Races/Authoring',
    stories: [
      { exportName: 'CreateBaseRace', id: 'domains-races-authoring--create-base-race', mode: 'editable' },
      { exportName: 'EditBaseRace', id: 'domains-races-authoring--edit-base-race', mode: 'editable' },
      { exportName: 'EditSubrace', id: 'domains-races-authoring--edit-subrace', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-races-authoring--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'spells',
    storyFile: 'src/domains/spells/stories/SpellAuthoring.stories.tsx',
    title: 'Domains/Spells/Authoring',
    stories: [
      { exportName: 'Create', id: 'domains-spells-authoring--create', mode: 'editable' },
      { exportName: 'EditOwned', id: 'domains-spells-authoring--edit-owned', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-spells-authoring--locked-master-readonly', mode: 'readonly' }
    ]
  },
  {
    domain: 'vehicles',
    storyFile: 'src/domains/vehicles/stories/VehicleForm.stories.tsx',
    title: 'Domains/Vehicles/Form',
    stories: [
      { exportName: 'CreateVehicle', id: 'domains-vehicles-form--create-vehicle', mode: 'editable' },
      { exportName: 'EditVehicle', id: 'domains-vehicles-form--edit-vehicle', mode: 'editable' },
      { exportName: 'LockedMasterReadonly', id: 'domains-vehicles-form--locked-master-readonly', mode: 'readonly' }
    ]
  }
] as const satisfies readonly AuthoringCoverageDomain[]

export const authoredFormCoverageStories = authoredFormCoverage.flatMap((domain) => (
  domain.stories.map((story) => ({
    ...story,
    domain: domain.domain
  }))
))
