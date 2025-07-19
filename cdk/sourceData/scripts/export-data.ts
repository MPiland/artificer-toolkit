import * as fs from 'fs'
import * as path from 'path'

type NestedKey = { key: string; file: string }
type DataFileEntry = { key: string; file?: string; nestedKeys?: NestedKey[] }
type DataToLoad = Record<string, DataFileEntry[]>

// --- Data Loading ---
const folderLocation = '../'
const systemsData: Record<string, any> = JSON.parse(fs.readFileSync(`${folderLocation}system/systems.json`, 'utf-8'))

const domainData: DataToLoad = {
  MasterSystemTable: [
    { key: 'abilities', file: `${folderLocation}system/abilities.json` },
    { key: 'actions', file: `${folderLocation}system/actions.json` },
    { key: 'alignments', file: `${folderLocation}system/alignments.json` },
    { key: 'attributes', file: `${folderLocation}system/systemAttributes.json` },
    { key: 'categories', file: `${folderLocation}system/systemCategories.json` },
    { key: 'characters', file: `${folderLocation}system/systemCharacters.json` },
    { key: 'charges', file: `${folderLocation}system/systemCharges.json` },
    { key: 'conditions', file: `${folderLocation}system/conditions.json` },
    { key: 'currencies', file: `${folderLocation}system/currencies.json` },
    { key: 'damageTypes', file: `${folderLocation}system/damageTypes.json` },
    {
      key: 'equipment',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/equipmentCategories.json` },
        { key: 'rarities', file: `${folderLocation}system/equipmentRarities.json` },
        { key: 'categoryProperties', file: `${folderLocation}system/equipmentCategoryProperties.json` },
        { key: 'properties', file: `${folderLocation}system/equipmentProperties.json` },
      ],
    },
    { key: 'languages', file: `${folderLocation}system/languages.json` },
    {
      key: 'modifiers',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/modifierCategories.json` },
        { key: 'types', file: `${folderLocation}system/modifierTypes.json` },
        { key: 'methods', file: `${folderLocation}system/modifierMethods.json` },
        { key: 'categoryTypes', file: `${folderLocation}system/modifierCategoryTypes.json` },
        { key: 'typeMethods', file: `${folderLocation}system/modifierTypeMethods.json` },
        { key: 'categoryMethods', file: `${folderLocation}system/modifierCategoryMethods.json` },
        { key: 'spellCategories', file: `${folderLocation}system/modifierSpellCategories.json` },
      ],
    },
    { key: 'passives', file: `${folderLocation}system/passives.json` },
    { key: 'prerequisites', file: `${folderLocation}system/systemPrerequisites.json` },
    {
      key: 'proficiencies',
      nestedKeys: [
        { key: 'levels', file: `${folderLocation}system/proficiencyLevels.json` },
        { key: 'categories', file: `${folderLocation}system/proficiencyCategories.json` },
      ],
    },
    { key: 'rules', file: `${folderLocation}system/rules.json` },
    { key: 'senses', file: `${folderLocation}system/senses.json` },
    { key: 'sizes', file: `${folderLocation}system/sizes.json` },
    { key: 'skills', file: `${folderLocation}system/skills.json` },
    { key: 'speeds', file: `${folderLocation}system/speeds.json` },
    {
      key: 'spells',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/spellCategories.json` },
        { key: 'durations', file: `${folderLocation}system/spellDurations.json` },
        { key: 'ranges', file: `${folderLocation}system/spellRanges.json` },
        { key: 'schools', file: `${folderLocation}system/spellSchools.json` },
        { key: 'shapes', file: `${folderLocation}system/spellShapes.json` },
        { key: 'requirements', file: `${folderLocation}system/spellRequirements.json` },
      ],
    },
    { key: 'terrains', file: `${folderLocation}system/terrains.json` },
  ],
  MasterSpellTable: [{ key: 'spells', file: `${folderLocation}spells/spells.json` }],
  MasterRaceTable: [{ key: 'races', file: `${folderLocation}races/races.json` }],
  MasterClassTable: [
    { key: 'classes', file: `${folderLocation}classes/base/classes.json` },
    { key: 'subclasses', file: `${folderLocation}classes/sub/subclasses.json` },
  ],
  MasterEquipmentTable: [{ key: 'equipment', file: `${folderLocation}equipment/equipment.json` }],
  MasterBackgroundTable: [{ key: 'backgrounds', file: `${folderLocation}backgrounds/backgrounds.json` }],
  MasterFeatTable: [{ key: 'feats', file: `${folderLocation}feats/feats.json` }],
}

const featureData: DataToLoad = {
  MasterFeatureTable: [{ key: 'feature', file: `${folderLocation}features/features.json` }],
  MasterAncestryOptionTable: [
    { key: 'ancestryOptions', file: `${folderLocation}ancestryOptions/ancestryOptions.json` },
  ],
  MasterFeatureSpellTable: [{ key: 'featureSpells', file: `${folderLocation}featureSpells/featureSpells.json` }],
  MasterFeatureModifierTable: [
    { key: 'featureModifiers', file: `${folderLocation}featureModifiers/featureModifiers.json` },
  ],
  MasterFeatureProficiencyTable: [
    { key: 'featureProficiencies', file: `${folderLocation}featureProficiencies/featureProficiencies.json` },
  ],
  MasterFeatureExpertiseTable: [
    { key: 'featureExpertises', file: `${folderLocation}featureExpertise/featureExpertise.json` },
  ],
  MasterFeatureSenseTable: [{ key: 'featureSenses', file: `${folderLocation}featureSenses/featureSenses.json` }],
  MasterFeatureOptionTable: [{ key: 'featureOptions', file: `${folderLocation}featureOptions/featureOptions.json` }],
}

function buildTableObject(tableDef: DataFileEntry[], baseObj?: Record<string, any>): Record<string, any> {
  // If baseObj is provided, start with a shallow copy of it
  const obj: Record<string, any> = baseObj ? { ...baseObj } : {};
  for (const { key, nestedKeys, file } of tableDef) {
    if (file) {
      obj[key] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } else {
      obj[key] = {};
    }
    if (nestedKeys) {
      for (const { key: nestedKey, file: nestedFile } of nestedKeys) {
        obj[key][nestedKey] = JSON.parse(fs.readFileSync(nestedFile, 'utf-8'));
      }
    }
  }
  return obj;
}

function exportAllTables(tables: Record<string, DataFileEntry[]>, outputDir: string, baseSystemObj?: Record<string, any>) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  for (const tableKey of Object.keys(tables)) {
    const tableDef = tables[tableKey];
    // Special case for MasterSystemTable: use the base system object
    const obj = (tableKey === 'MasterSystemTable' && baseSystemObj)
      ? buildTableObject(tableDef, baseSystemObj)
      : buildTableObject(tableDef);
    const outputPath = path.join(outputDir, `${tableKey}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(obj, null, 2), 'utf-8');
    console.log(`Wrote: ${outputPath}`);
  }
}

// --- Main ---
console.log('Exporting all tables to output/ directory...');
const outputDir = path.join(__dirname, '../output');
exportAllTables(domainData, outputDir, systemsData); // Pass systemsData for MasterSystemTable
exportAllTables(featureData, outputDir);
console.log('Done!');
