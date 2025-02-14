export enum Abilities {
  constitution = '492f208f-6e7a-4a69-bbf2-047389576246',
  dexterity = '9a6cbe6e-9119-4a84-8a13-24b45a614dcc',
  wisdom = '458fdf58-0496-4701-86d0-7bc234009276',
  strength = '93607465-de3d-4788-a5e0-df290fda7959',
  intelligence = 'd0cd6776-ef2c-4589-8a18-175a160b8ef4',
  charisma = 'def276fe-3fa5-4af7-95ad-a37113815cc7',
}

export enum Skills {
  acrobatics = '8800b4eb-8fbc-47bc-a6a8-c71fd8afd6cc',
  animalHandling = 'f6ac4c05-edf8-4d25-9098-2c3603f328b1',
  arcana = '7c9ea3de-9d0b-4518-b5ff-b02af5b87b1f',
  athletics = '58f04f10-8886-401a-8c5e-06279154f148',
  deception = '1382f52c-2281-441f-8fb2-608a274a13d3',
  history = 'f01f2fbd-d1a7-4e7e-8645-fbdc743cd55b',
  insight = '882113b0-b4ab-4904-95d7-ad2231bef7d4',
  intimidation = 'dba004ae-16aa-40ac-8df1-2f2c47775f6c',
  investigation = '97347fe6-1b4c-43df-832c-f07403dc076e',
  medicine = '0e26ef5e-d29f-4b66-a1fe-da82f3d800b1',
  nature = '521debf5-9212-49db-8fa1-5ee9e01861c3',
  perception = '1fc0087a-7532-4023-be0b-6c50fe577d60',
  performance = '4f30c82e-25f8-4918-ada5-614ddf3c1257',
  persuasion = '7377834f-6811-4151-bdf0-a621409221db',
  religion = 'ed704543-3bbc-4026-a611-823a6ac69c5c',
  sleightOfHand = '3c2cfcf2-2fb5-464f-839d-f5a9703bcfb7',
  stealth = 'b598a80e-d7e8-47fb-8438-f79151223afe',
  survival = '34d3640f-ecb8-4107-b140-bb59e2cb1001',
}

export enum Actions {
  bonusAction = 'e35ec180-335c-4630-8f4c-9858ee8823fb',
  special = 'cb1b5c45-5ca3-4822-ab16-28a446947df5',
  hour = 'de8f279a-22c0-4087-ba46-922a60caa433',
  attack = '41208ceb-837c-4af5-9a8a-0f92acf31237',
  reaction = '559d6655-9929-4bfa-8928-bfb02c86f62a',
  action = 'ec034006-0d37-4687-b426-e8c4dc091b27',
  minute = 'abecb36b-c245-4342-ac8b-a6448b70a079',
}

export enum Conditions {
  deafened = 'ea08e0fd-5547-4274-a7db-6a8797fea20e',
  frightened = '5692845d-057f-4bef-bf66-7d74bd580efc',
  grappled = '783f6505-82e5-4904-a833-76b326665473',
  exhaustion = 'f34fddd2-3e6f-4591-9b57-961f325ad956',
  charmed = 'd3693c1b-6fcd-47ee-a8db-27e1a35be976',
  paralyzed = '196071b6-8e7d-4996-9e78-c0d274e797f8',
  stunned = 'f3a65935-1a6b-4783-a6a9-6c077706506b',
  invisible = '7fa41acb-bbed-4d4d-844c-a818d4ff5037',
  restrained = '02b1093c-6deb-4850-883d-806f66ab8498',
  petrified = '08769de5-8833-443a-8510-dce83df11c59',
  incapacitated = 'a2cd151a-5692-458b-93d3-18db995f9030',
  prone = '07fae8d9-e005-4bcf-8e34-a25e4422277f',
  unconscious = '2941670c-0595-4304-bb10-9198e17c0ca1',
  blinded = 'e7feae3a-6ca4-4599-a7fe-92daefc620a4',
  poisoned = '0a21062b-d7b5-48c7-a7d9-7546c2f69223',
}

export enum DamageTypes {
  lightning = 'd28827d8-177f-4e9f-9570-df37003e1c6f',
  acid = '22e6119f-fad5-44b1-92e7-be0bd9b8333d',
  cold = '13ebcaa8-8789-4ce1-8a44-9bcc58c3c9fe',
  psychic = 'e33319c6-2e67-4e54-901d-9f9af4e271ed',
  necrotic = 'd5fe15a7-2c6e-4153-a7a3-259ac1dbe759',
  radiant = 'cb8cef81-ccd8-4084-b7a5-7dc39149873f',
  force = '24e79760-06ca-4378-8cf4-6f96ba98b3af',
  poison = 'f8473724-d388-4387-8e2b-967ed5c90934',
  healing = 'a8d594fd-6ac9-49c8-aa26-8f6ac8d5320d',
  fire = 'e72e5731-29c3-4e78-ab14-ba93296a3ac4',
  slashing = '95f7686e-17f7-42ec-b20f-ba2cb4d25af2',
  thunder = '9da11bac-04f3-4136-8ec6-292889129320',
  piercing = '0140d436-010e-4705-b65b-0a87e3c04d03',
  bludgeoning = 'f0e1a4c8-6663-4c53-a4f2-da1dedbe2ead',
}

export enum Prerequisites {
  equipped = 'ef32cce6-78ec-47e6-a9d2-9be64074a76b',
  notEquipped = '68fb064f-ea56-4fd0-b7cf-64cdbdeef95d',
  skillProficiency = 'b7d0a3c3-7b6f-4c0d-9e9f-0d6d8c8c8c8c',
  equipmentProficiency = 'f603f26f-6cb6-4995-82f3-ba4cdefd4e55',
  abilityScore = '096cf44a-60ec-4f6c-b42c-3c46e12530bb',
  notProficient = '3e8abd1f-614c-4b5e-9429-e5819a868c8d',
  spellsKnown = 'de774c82-b1d6-4f6c-b73c-84cf370c60ff',
  canCast = '2b2cac99-dfc5-45a0-b4a6-1970179ebcd9',
  optionNotAcquired = '3fe944fc-a9d5-4afa-929a-c8b2805d70e3',
  featuresKnown = '293010e4-fe1f-4982-8a80-6a232eafe19f',
  characterSize = 'd5def5fd-4b6e-411b-994d-3e830912093e',
}

export enum ChargesResets {
  longRest = '5ea2bd3d-0b92-4c8a-910a-02be01719fcb',
  shortRest = 'c245fd8b-f343-4fb1-a6c4-5bc35ca43ac7',
  manual = '97f4a2d5-c88b-43d8-8255-330e5aa04684',
}

export enum ChargesLimits {
  proficiency = 'b014c7d9-8a98-48a9-91f2-aa55345c93c9',
  skill = 'b8a4152b-ed51-4fe4-a6fc-a9a16fcb2aa6',
  abilityScoreModifier = '0bc73f5e-e99a-470d-b95d-bbdc4005331f',
  setAmount = 'f21220f9-96db-4369-ba11-88c87d631fac',
  poolAmount = 'ce085d90-e051-4d80-855c-b9c421b6ed8b',
  resourcePoints = 'c6b4ecb8-9246-4235-8e8a-4648d63a7ebe',
  setPerLevel = '0a010337-44d9-491e-9fb2-bc94961fe2a2',
  usesPerLevel = '19d5f00e-c246-4478-9eb9-7b7ec2b942ed',
  ability = '12ea359b-7b7c-4d7f-89b1-465ac9e5048e',
}

export enum Categories {
  base = 'b62cef0d-a4be-4cfe-94ee-c80a7aaaabc7',
  subrace = '75a580dc-6990-4c05-9853-1534c5be77f7',
  variant = 'a857f226-e09b-441f-9a09-f25c85beca1a',
  feature = '4ef09e58-8d0f-4ebe-bfbf-d32a6d1bd19c',
  subclass = '635bbde6-8c7f-4730-bb83-fb3be8d9006a',
}

export enum Attributes {
  hideOnSheet = '736ee797-e8a8-481a-83c0-ec166a027614',
  showAsAttack = '02918555-68f6-4041-b051-87da14b44279',
  addToWeaponAttack = '5ad88a48-ca9e-4bb5-b005-6600effbc620',
  limitTargets = 'd409bef0-5b16-41d5-af77-d91cd202fd19',
  limitUse = '408bd86e-2ed9-4da6-9932-0e99a6e40e17',
  isAction = '84916f75-92c2-4ee6-abe0-cc038128f0fc',
  doesDamage = '348c49e2-a25e-42d6-8357-390530243929',
  hasRange = '96a72204-a97a-4a55-845a-077120c95d6e',
  dcRequired = 'c046e268-1275-4c2b-b647-cfc85eb39b9a',
  prerequisites = '40a91f3a-8909-4593-8a5f-b66b364602bb',
  addProficiencyBonus = '99d19345-51a7-4364-ad26-fb1dbf9c0342',
  addAbilityModifier = 'a6a71a7a-6951-4441-90be-73fc779d0aee',
  spellDC = '60cb5190-54c0-430d-88f1-c34e7ba7ec01',
  replaceAtLevel = '2eec6a5e-a7b3-4263-84dd-d977cce4cc79',
  selectCountByLevel = '87e26eca-3d18-4858-aa3e-c6efc6d15a59',
  providesOptions = '3fadd608-c46e-4718-a2b5-10d50fffbbdb',
  isRitual = '5dd4f91e-074d-47c0-8c34-db750ea75b05',
  requiresConcentration = '854fdc5a-6168-4b35-96af-d3b3713edf4c',
  usesSlot = 'ba23bfae-3039-4c7f-a98a-474b76e85cc6',
  optionalAbility = 'fd1e8360-da3b-45cf-ac35-b4ad4ab53bcd',
  alwaysPrepared = 'cabe9cde-c846-426f-8f55-e23a40e0367b',
  spellsByLevel = '4b29c54a-b258-42ec-a877-4fbd6873f760',
  classLimit = '1bec624b-14c4-4fe7-baa5-277277394bbf',
  attributeLimit = '3028c7fb-536a-4a6e-8b77-dea57ff51214',
  levelLimit = 'a354fe6c-c7e0-4551-b444-756e62fd672c',
  castAtLevel = 'ecee08e1-2f04-404b-bdc7-7eadcb9656e1',
  requiresProficiency = 'f481b458-1b44-4d15-80b0-e2b758576c04',
  subtypeSpecific = 'ab6aa1a2-8cd6-438b-9060-079a4c3d07df',
  canEquip = 'c88dafe7-0494-4913-83d9-34fcf7904196',
  isMagic = '6baf01cd-59bc-4dfd-9874-40b3aebe7170',
  stackable = '5bfaaaf4-f5d0-40de-9c07-ec441d75bf51',
  requireAttunement = 'b5d460e5-3443-49e5-b736-77cf4d2dfb21',
  maxBonus = '265c6cc0-1de4-40b7-be69-4cacd43b77fe',
  containsEquipment = 'd8a46d89-3e37-4a79-862f-8f503bcecd8a',
  appliesCondition = '4662b9f7-cf83-404a-8d33-a046c6441dae',
  secondaryAction = 'bb8315e1-6f48-4ab5-b650-0e3af7c670a2',
  primaryAbility = 'e8b2aedf-be41-4b4c-9754-2dc6a9a4b1c9',
  optionalPrimaryAbility = 'f63b9fd5-e517-45af-afca-8e8a5a0ee933',
  secondaryAbility = 'dfc0ec46-623e-4d8d-8101-7234494414bb',
  spellcaster = '59c97c68-d773-4434-925f-ca9c1be3d2d8',
  subtypes = '36aeab69-fada-4f08-a4e0-215b34d5b4d5',
  hasResourcePoints = '250a1629-5bd7-486b-a007-be78ac43013d',
  ritualCaster = 'becce5cb-5f1e-4de8-9aca-74324f507063',
  limitKnownSpells = '9b919427-7c38-4ccd-aecd-6c032a047b57',
  preparesSpells = 'b7ad7cc0-736d-416b-aed6-a374857adcd0',
  magicName = '01965583-8b20-4b30-8b9f-ffe5fe8d10a1',
  usesSpellbook = 'ee9294ea-90a0-4c70-92d6-6ee8f4d31f15',
  primaryDamage = 'cb47b615-2a96-4617-870a-9051ab4b95cf',
  bonusDamage = '412e4b5f-f202-4519-851f-03965749051a',
  range = '80a52d60-b644-4623-b87a-88c70799cdb4',
  targets = 'c4611274-295d-453a-8441-4d41ba519777',
  shape = '24d16527-d6b2-4f85-b8ee-906ed3238d47',
  duration = '075fc5db-1dcd-404b-9d75-8c776e2db96a',
  secondaryDamage = '90ed849a-a870-419c-b58b-451afeeff7bb',
  setAmount = '119789c9-909c-499a-8936-6777efb9b990',
  damagePool = '9b8224bf-1c64-4399-b7b0-428cc2443b37',
  diePerLevel = '281ec9af-79ff-41d2-b2aa-c9a6ea1f5ed5',
  setPerLevel = '2518eb43-581a-4611-a45d-95f75ad449cc',
  proficiency = '3fd3a5ba-33fb-48ee-9dd9-086f859e6c8a',
  spellcastingAbility = 'b5857657-75a7-4290-aef9-85a3f87fd8c6',
  ability = '0c6a576c-ce1f-4b19-8c80-f0780d80de8f',
  level = '5c8b45be-9612-48a9-848a-4665fec0b22c',
  spellAbility = '22936831-1dd1-49a8-a4af-08e0746eb9b4',
  classLevel = '384bdd3d-dece-4e71-88b0-c1fc44130987',
  requiresSave = '13e4400f-aeed-4a6a-a2f3-9f661862ddd9',
  canUpcast = 'af40a76d-56cb-4c32-9b61-110847edc481',
  weight = '14b3ca23-2b10-4bfc-a763-f543a72fa3e2',
  abilityBonus = 'cfbc3740-2afc-448e-a7d4-0cd1ad530fef',
  altType = '63ed8641-6ff4-4807-a61d-d43a0c2b6926',
  expandsSpellList = '57351a56-9b66-46cf-8c85-be7702172185',
  classStyle = '3764d329-dff1-4d17-8d22-ef9a0f5bc60d',
}

export enum CharacterAdvancement {
  milestone = '24e31dc8-43ab-43de-89fe-15c878951d48',
  experience = '0bdb9b1a-cc40-40f5-95cf-390506b256d8',
}

export enum CharacterHitpoints {
  fixed = '567dff1c-e39e-4faa-a544-42fcf3970e66',
  manual = 'e99940d3-4a67-475a-8c41-860744111557',
}

export enum CharacterSpellPointCalc {
  spellAbility = '478991e3-ca27-4f9e-96b5-60efe9b29058',
  ClassLevel = 'dad0ee93-c507-4c93-80de-39275cd94c98',
}

export enum Terrains {
  coast = '1297bea1-4de3-4e38-9484-5313d92aee70',
  forest = '1201ab99-e0ee-4026-938d-cb491fa45635',
  grassland = 'dfedf88c-e41b-43ff-8a79-d35050693714',
  arctic = '844e7f70-45ca-4b5b-bc61-5cbade60d569',
  swamp = '9243c7f2-886c-4cdb-b97e-9ca15e9780c1',
  mountain = 'd17eebcf-13e4-484a-9ff8-95ce67aca5ee',
  desert = 'fe2a8a37-a855-40fa-9909-090d2444f9a8',
}

// Equipment

export enum EquipmentCategories {
  armor = 'ce0b70ab-2ddb-4852-b4bb-dbf7108ee2ea',
  weapon = '973c8a5e-59d3-42f8-bd1b-77e8b0ee0893',
  adventuringGear = 'c9af75e8-fff6-4247-8db4-31f63f16b3d9',
  tool = 'e13981d6-2b10-4b79-adb6-07b2d85f711e',
  shield = '81990afe-e34a-48cb-aece-5e7c46088615',
  waterVehicle = 'c246e38a-8247-45ef-b7d9-65f0f74d261c',
  mount = '5af95ce6-0c76-4673-bc56-5c3d1df03bad',
  currency = '00e0cca8-b2a4-4b48-bf54-d7db7d0ed5da',
}

export enum EquipmentProperties {
  heavyArmor = 'f0de1c52-9141-4d5a-bc4b-76110edf8e3e',
  mediumArmor = 'df5b0efb-0ab4-44e8-845a-13f109331d9b',
  lightArmor = '786e4da5-d0a7-4d30-9232-864950691654',
  versatile = '6833776a-26c0-4143-b367-39f81a2fdad7',
  light = 'cd909c00-7311-4643-be4d-497b095f7c72',
  heavy = '1ce89a34-1e5e-4773-af2a-212df276371b',
  twoHanded = '71b5b42c-f4bc-4319-85ab-9e888d00743c',
  loading = 'dc9ee927-f81e-4966-bfce-6e12813fedb6',
  simple = 'ab95948e-73af-4cd6-ac18-a22841fb5773',
  ranged = '756bfbbe-e9a4-4080-abdf-613fe2443fcf',
  reach = 'c3797121-b46d-4b04-9dfd-71a0ba0a7945',
  thrown = 'cb8f55bc-c9e5-4406-b408-e8caf6d5bd5b',
  finesse = 'f2db5999-dba0-4e27-a260-7153aee16335',
  martial = '9fa816b5-a0cd-474f-9dee-f7de93e22803',
  special = '859a1a8a-bf82-4bd0-b45a-65386ec068be',
  melee = '72f57c5d-c213-4b1b-887f-1eea56f02fe2',
  vial = 'b3429a94-145d-4cdd-9842-78a826056942',
  flask = '993c120c-05c3-4d56-b2a3-2e0c073c082a',
  ammunition = 'be798ea9-2db6-4eb9-89ce-1073e09f9fe6',
  container = '7e27efc4-7b48-48b1-913b-c48cd500b020',
  improvisedWeapon = '6ee3e6eb-8d3b-46bc-aacf-18d657bd1913',
  poison = 'a77dd525-f359-49df-b5b9-cf9069d5ea24',
  potion = '0bed3288-ee9a-46f3-9205-ad223baaaddb',
  scroll = '93e6f0d0-a106-404d-94c6-0e7ea0f1ff94',
  wondrousItem = '5d0f456e-4f79-4a39-a98b-b5a7c51ae914',
  arcaneFocus = 'd012faee-75b7-4cee-a4ba-55246289c6c2',
  clothing = 'd6d3c7a1-e868-44e4-bb25-ad169e6186c9',
  druidicFocus = '68163324-bcb2-45c1-b465-7ac1976e49fb',
  holySymbol = '5f5ac5fa-2602-4104-8abd-86a2c413056f',
  food = '78354594-9697-4237-a0c3-9cad5521a025',
  drink = 'ec5423a7-4e9f-474c-bb31-55d783b82714',
  artisanTool = '112f51e4-cee6-4fd0-8207-163da4cbd397',
  gamingSet = '51ec3d3a-6ade-4ad3-9dfc-8efecdeeb4ba',
  musicalInstrument = '96ae55ee-79fa-44e8-9fb8-c96d713a6424',
  professionTool = '98da1d55-0445-4927-ac40-cd05fc14fe6d',
  wood = '44478ef1-2c6f-4b7c-8b49-c364a77e5bb9',
  metal = 'a6cf86fd-8553-41a6-a6bf-24110e1e91f1',
}

// Spell

export enum SpellRequirements {
  material = '53d3d905-7caf-4d03-95d2-738b175dafd1',
  somatic = 'cd128433-b9c4-464a-a534-14a7e572a831',
  verbal = 'c4e2c8d7-7d2c-4c6c-8c4f-7d2c4c6c8c4f',
}

export enum Ranges {
  touch = '621c3456-b626-4114-a216-77d873d1bf0c',
  self = '802209e7-f09e-4c8d-b9b6-5cb49ebde9d2',
  distance = '0a02ce70-1f0e-4779-83d6-d1cbc0b95d68',
  sight = 'bb413b61-0940-4bf4-ba52-58295c150956',
  unlimited = 'f26b3629-ef8b-46dc-a9c6-5b672885f420',
  special = '1358e872-e297-40f0-975d-89266252af45',
}

export enum Durations {
  round = '58df1eeb-dc60-4405-aeb8-a46d782387c6',
  minute = '74c7ba5c-1d09-4499-a668-2839918a7b88',
  hour = 'e01ab65f-eedb-4b92-8a5c-b76b66cdcc8b',
  day = 'ddab6622-f448-486d-870d-8eabe2d14d3c',
  year = '9274bba6-fcd0-43af-a174-f35d5ae033f3',
  instantaneous = '738134fc-50af-4aa7-8893-e58248097854',
  untilDispelled = 'a0b373d7-31a1-46e9-a7e7-dd086f3b6e1f',
  special = '9e8d0be7-f199-4b88-92a7-7b55af6d06d2',
}

export enum Shapes {
  sphere = '1e2044d0-639d-4537-b3d0-edf4cfee3e3a',
  cone = 'b17d04fe-411e-4bef-96c1-4d88cbc35261',
  cube = 'dab56229-deac-4dbd-87e0-a2fac9cb137b',
  beam = 'db8561cd-ba0b-4c8f-b162-8c5acc524b66',
  weapon = '043a6c80-e33a-41b6-b31d-3c04dbdb5042',
  none = 'fbda8bf2-d2fe-4ac3-8c23-bbb9e42b8500',
  wall = '8166a305-6091-4f77-907e-36ea9833739f',
  cylinder = 'a2a01a4f-a95a-4b76-8367-cb4eeb779c1c',
  circle = '62b4316f-0b73-4f54-8d60-ba825f0f6b3d',
  square = '0777087a-7aef-4465-96a8-18a10871bde5',
}

// Modifiers

export enum ModifierCategories {
  saveAbilities = '971fbd66-c149-4bc5-80bf-ee4eeab053b2',
  armorClass = '430dbf81-4165-4b7d-8a39-1c959715e3e6',
  skills = '9ae9aef6-5442-495e-bcf3-216b0e1a4c58',
  unarmedAttack = 'b35b941f-8ad6-461f-8640-7540dc8e4934',
  unarmedDamage = '7218423b-56cf-44b8-bac9-8c62a6cb2e55',
  meleeAttack = '6387fe43-b305-4121-bfb4-b337df754868',
  meleeDamage = '50f3cf5c-47f9-4f61-9bc5-b4464bbd8bd1',
  rangeAttack = '105a7606-28ac-4bc6-88ef-11d0be9ec6bd',
  rangeDamage = '7b294017-f4bf-43e4-803f-b11f002273b1',
  spellAttack = 'bf17f1cf-8fa5-4372-b17d-93106bde8eef',
  spellDC = '07c9be79-c207-4fee-92e4-7842126a73c5',
  damageTypes = 'f03223d4-22ee-4866-8abf-1757791d356c',
  abilityScores = 'cc8af2eb-9dab-40b7-a7e7-d5815ecd32f9',
  speeds = '0168aa65-99ea-4381-9997-11f12f7adbfc',
  conditions = 'ecb7dc40-c822-4178-ac75-bb3ad1eb1236',
  proficiencyBonus = 'c723554f-7e53-49c6-aa62-74e33b7736ad',
  initiative = '2d619720-5819-4dee-aec2-4f13f5c72c5c',
  hitpoints = 'e33fba7e-27f1-4562-a270-90baa234e1aa',
  spellDamage = '526b7457-00b0-40b9-a163-e1f598a0d8b5',
  damageSave = '1c2b4037-ba93-4edc-8299-323e60dc934e',
  conditionSave = 'e7012bf9-4e83-4e31-888f-d4674d4ef865',
  charge = 'fa7b799a-a26b-4ca2-b0eb-1cbf6f700730',
  spell = 'c0ea7ecb-1dd9-419a-8220-32a0db629401',
}

export enum ModifierSpellCategories {
  spellDamage = '4e160791-f35b-4673-8d18-7fcf40f0ab2d',
  spellShape = '9ec47cfe-5a3d-422e-8766-6a14567e3847',
  spellRange = '69da6ffc-75cc-423f-b4df-d25761887059',
  spellDuration = 'c28701c5-ecd4-4499-9c2d-69ec5497c009',
}

export enum ModifierTypes {
  bonus = 'f6478862-a92b-4596-8420-c0fa958db719',
  penalty = '0ef0e6a9-184d-4e59-bb36-de6672c18dbf',
  advantage = '3a173c5b-0be0-4c2f-807e-52c5117acc92',
  disadvantage = '888ee438-a5bb-49a0-baf7-f31283bb92f3',
  setAmount = '6a038302-1ac7-482f-acdc-3e1502e04397',
  replaceModifierAbility = '5430dc37-daf9-4a47-b210-5791c3118c50',
  addOptionalModifierAbility = 'e51e28bb-a286-43cb-b9bd-3bb337ac30ef',
  bonusDie = 'f4db2cea-b243-485b-8c94-eb007f051d70',
  penaltyDie = '6cb31b79-af1c-48e8-a9a9-b2467ec741d3',
  maxDamage = '21c976de-e2c3-4f97-82b1-292c42921332',
  setDie = '80c68942-4fdf-4774-8027-8292ce508990',
  resistance = '7b202c09-bdd0-43df-8225-6232de134e3d',
  immunity = '4d5f63ef-833e-4a65-ab7d-2659f028281a',
  vulnerability = '8814744f-d842-49ed-9d99-9505d6a75925',
  useReset = '6086fb91-0939-4bbd-9f78-dd9d130e4c91',
}

export enum ModifierMethods {
  abilityScoreModifier = 'dc943fe2-04be-4bfe-a935-4bc70fecac3d',
  setGlobally = '5e45a4d2-b4c7-449d-8f37-b58fcf34a140',
  setPerLevel = '064697c0-eb11-4b6a-81b9-f2ecdd722194',
  skillModifier = '38539453-736e-417a-905e-573cc654ae19',
  proficiencyBonus = 'f4e93274-0ebe-4357-9c1e-8c57fc31cc91',
  spellLevel = 'a919adf5-4526-4472-b9af-31e400ef6f52',
}

// Proficiencies

export enum ProficiencyCategories {
  skills = '36ae498d-4f96-4fa1-a82a-4f59866f619b',
  saveAbilities = '7328d22a-8c29-45de-a08f-5987fac2d6d1',
  properties = '3d1075dc-8a5e-419a-90d4-7c2c2c29ff32',
  equipment = '3d256b38-0c78-4fd6-84a5-94b43c5a024c',
  languages = '43780ab4-fe83-4477-bd6a-4d3343044f8c',
  initiative = '5a8d9e8c-508c-4175-866e-f57925ba41e6',
}

export enum ProficiencyLevels {
  halfProficiency = 'cb68f387-1e4f-4bbf-87af-34fca3ef4937',
  expert = 'c591641c-1da9-4d0e-83b8-1caec9d23ae7',
  proficient = '4b6510ec-9e6e-4f83-945f-84f418393c0c',
}

export enum Measurement {
  full = 'c01064bc-eea0-48d1-824a-3fb0ae983822',
  half = '88789395-3e9a-4ff3-bf69-bd13be9cdaf8',
}

export enum Rounding {
  down = '7a7dc0de-c6bb-4afe-9507-5446c1b85a67',
  up = '9fbbeab4-0a0a-403a-94a1-dbbbe93471c5',
}

export enum AbilityGenerate {
  standardArray = '3c634a28-ada5-40f4-b79d-ef239ec0f70a',
  manual = '10e22411-2e4f-4f46-a487-aeda49f8b5e2',
  pointBuy = '258a046e-a301-4280-965e-67d228362871',
}
