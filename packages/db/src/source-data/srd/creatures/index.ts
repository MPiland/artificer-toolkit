import { aboleth } from './aboleth.js'
import { acolyte } from './acolyte.js'
import { normalizeLegendaryActionOptions } from './shared.js'
import { applyCreatureEquipmentLoadouts } from './equipment-loadouts.js'
import { adultBlackDragon } from './adult-black-dragon.js'
import { adultBlueDragon } from './adult-blue-dragon.js'
import { adultBrassDragon } from './adult-brass-dragon.js'
import { adultBronzeDragon } from './adult-bronze-dragon.js'
import { adultCopperDragon } from './adult-copper-dragon.js'
import { adultGoldDragon } from './adult-gold-dragon.js'
import { adultGreenDragon } from './adult-green-dragon.js'
import { adultRedDragon } from './adult-red-dragon.js'
import { adultSilverDragon } from './adult-silver-dragon.js'
import { adultWhiteDragon } from './adult-white-dragon.js'
import { airElemental } from './air-elemental.js'
import { ancientBlackDragon } from './ancient-black-dragon.js'
import { ancientBlueDragon } from './ancient-blue-dragon.js'
import { ancientBrassDragon } from './ancient-brass-dragon.js'
import { ancientBronzeDragon } from './ancient-bronze-dragon.js'
import { ancientCopperDragon } from './ancient-copper-dragon.js'
import { ancientGoldDragon } from './ancient-gold-dragon.js'
import { ancientGreenDragon } from './ancient-green-dragon.js'
import { ancientRedDragon } from './ancient-red-dragon.js'
import { ancientSilverDragon } from './ancient-silver-dragon.js'
import { ancientWhiteDragon } from './ancient-white-dragon.js'
import { androsphinx } from './androsphinx.js'
import { animatedArmor } from './animated-armor.js'
import { ankheg } from './ankheg.js'
import { ape } from './ape.js'
import { archmage } from './archmage.js'
import { assassin } from './assassin.js'
import { awakenedShrub } from './awakened-shrub.js'
import { awakenedTree } from './awakened-tree.js'
import { axeBeak } from './axe-beak.js'
import { azer } from './azer.js'
import { baboon } from './baboon.js'
import { badger } from './badger.js'
import { balor } from './balor.js'
import { bandit } from './bandit.js'
import { banditCaptain } from './bandit-captain.js'
import { barbedDevil } from './barbed-devil.js'
import { basilisk } from './basilisk.js'
import { bat } from './bat.js'
import { beardedDevil } from './bearded-devil.js'
import { behir } from './behir.js'
import { berserker } from './berserker.js'
import { blackBear } from './black-bear.js'
import { blackDragonWyrmling } from './black-dragon-wyrmling.js'
import { blackPudding } from './black-pudding.js'
import { blinkDog } from './blink-dog.js'
import { bloodHawk } from './blood-hawk.js'
import { blueDragonWyrmling } from './blue-dragon-wyrmling.js'
import { boar } from './boar.js'
import { boneDevil } from './bone-devil.js'
import { brassDragonWyrmling } from './brass-dragon-wyrmling.js'
import { bronzeDragonWyrmling } from './bronze-dragon-wyrmling.js'
import { brownBear } from './brown-bear.js'
import { bugbear } from './bugbear.js'
import { bulette } from './bulette.js'
import { camel } from './camel.js'
import { cat } from './cat.js'
import { centaur } from './centaur.js'
import { chainDevil } from './chain-devil.js'
import { chimera } from './chimera.js'
import { chuul } from './chuul.js'
import { clayGolem } from './clay-golem.js'
import { cloaker } from './cloaker.js'
import { cloudGiant } from './cloud-giant.js'
import { cockatrice } from './cockatrice.js'
import { commoner } from './commoner.js'
import { constrictorSnake } from './constrictor-snake.js'
import { copperDragonWyrmling } from './copper-dragon-wyrmling.js'
import { couatl } from './couatl.js'
import { crab } from './crab.js'
import { crocodile } from './crocodile.js'
import { cultFanatic } from './cult-fanatic.js'
import { cultist } from './cultist.js'
import { darkmantle } from './darkmantle.js'
import { deathDog } from './death-dog.js'
import { deepGnomeSvirfneblin } from './deep-gnome-svirfneblin.js'
import { deer } from './deer.js'
import { deva } from './deva.js'
import { direWolf } from './dire-wolf.js'
import { djinni } from './djinni.js'
import { doppelganger } from './doppelganger.js'
import { draftHorse } from './draft-horse.js'
import { dragonTurtle } from './dragon-turtle.js'
import { dretch } from './dretch.js'
import { drider } from './drider.js'
import { drow } from './drow.js'
import { druid } from './druid.js'
import { dryad } from './dryad.js'
import { duergar } from './duergar.js'
import { dustMephit } from './dust-mephit.js'
import { eagle } from './eagle.js'
import { earthElemental } from './earth-elemental.js'
import { efreeti } from './efreeti.js'
import { elephant } from './elephant.js'
import { elk } from './elk.js'
import { erinyes } from './erinyes.js'
import { ettercap } from './ettercap.js'
import { ettin } from './ettin.js'
import { fireElemental } from './fire-elemental.js'
import { fireGiant } from './fire-giant.js'
import { fleshGolem } from './flesh-golem.js'
import { flyingSnake } from './flying-snake.js'
import { flyingSword } from './flying-sword.js'
import { frog } from './frog.js'
import { frostGiant } from './frost-giant.js'
import { gargoyle } from './gargoyle.js'
import { gelatinousCube } from './gelatinous-cube.js'
import { ghast } from './ghast.js'
import { ghost } from './ghost.js'
import { ghoul } from './ghoul.js'
import { giantApe } from './giant-ape.js'
import { giantBadger } from './giant-badger.js'
import { giantBat } from './giant-bat.js'
import { giantBoar } from './giant-boar.js'
import { giantCentipede } from './giant-centipede.js'
import { giantConstrictorSnake } from './giant-constrictor-snake.js'
import { giantCrab } from './giant-crab.js'
import { giantCrocodile } from './giant-crocodile.js'
import { giantEagle } from './giant-eagle.js'
import { giantElk } from './giant-elk.js'
import { giantFireBeetle } from './giant-fire-beetle.js'
import { giantFrog } from './giant-frog.js'
import { giantGoat } from './giant-goat.js'
import { giantHyena } from './giant-hyena.js'
import { giantLizard } from './giant-lizard.js'
import { giantOctopus } from './giant-octopus.js'
import { giantOwl } from './giant-owl.js'
import { giantPoisonousSnake } from './giant-poisonous-snake.js'
import { giantRat } from './giant-rat.js'
import { giantScorpion } from './giant-scorpion.js'
import { giantSeaHorse } from './giant-sea-horse.js'
import { giantShark } from './giant-shark.js'
import { giantSpider } from './giant-spider.js'
import { giantToad } from './giant-toad.js'
import { giantVulture } from './giant-vulture.js'
import { giantWasp } from './giant-wasp.js'
import { giantWeasel } from './giant-weasel.js'
import { giantWolfSpider } from './giant-wolf-spider.js'
import { gibberingMouther } from './gibbering-mouther.js'
import { glabrezu } from './glabrezu.js'
import { gladiator } from './gladiator.js'
import { gnoll } from './gnoll.js'
import { goat } from './goat.js'
import { goblin } from './goblin.js'
import { goldDragonWyrmling } from './gold-dragon-wyrmling.js'
import { gorgon } from './gorgon.js'
import { grayOoze } from './gray-ooze.js'
import { greenDragonWyrmling } from './green-dragon-wyrmling.js'
import { greenHag } from './green-hag.js'
import { grick } from './grick.js'
import { griffon } from './griffon.js'
import { grimlock } from './grimlock.js'
import { guard } from './guard.js'
import { guardianNaga } from './guardian-naga.js'
import { gynosphinx } from './gynosphinx.js'
import { halfRedDragonVeteran } from './half-red-dragon-veteran.js'
import { harpy } from './harpy.js'
import { hawk } from './hawk.js'
import { hellHound } from './hell-hound.js'
import { hezrou } from './hezrou.js'
import { hillGiant } from './hill-giant.js'
import { hippogriff } from './hippogriff.js'
import { hobgoblin } from './hobgoblin.js'
import { homunculus } from './homunculus.js'
import { hornedDevil } from './horned-devil.js'
import { hunterShark } from './hunter-shark.js'
import { hydra } from './hydra.js'
import { hyena } from './hyena.js'
import { iceDevil } from './ice-devil.js'
import { iceMephit } from './ice-mephit.js'
import { imp } from './imp.js'
import { invisibleStalker } from './invisible-stalker.js'
import { ironGolem } from './iron-golem.js'
import { jackal } from './jackal.js'
import { killerWhale } from './killer-whale.js'
import { knight } from './knight.js'
import { kobold } from './kobold.js'
import { kraken } from './kraken.js'
import { lamia } from './lamia.js'
import { lemure } from './lemure.js'
import { lich } from './lich.js'
import { lion } from './lion.js'
import { lizard } from './lizard.js'
import { lizardfolk } from './lizardfolk.js'
import { mage } from './mage.js'
import { magmaMephit } from './magma-mephit.js'
import { magmin } from './magmin.js'
import { mammoth } from './mammoth.js'
import { manticore } from './manticore.js'
import { marilith } from './marilith.js'
import { mastiff } from './mastiff.js'
import { medusa } from './medusa.js'
import { merfolk } from './merfolk.js'
import { merrow } from './merrow.js'
import { mimic } from './mimic.js'
import { minotaur } from './minotaur.js'
import { minotaurSkeleton } from './minotaur-skeleton.js'
import { mule } from './mule.js'
import { mummy } from './mummy.js'
import { mummyLord } from './mummy-lord.js'
import { nalfeshnee } from './nalfeshnee.js'
import { nightHag } from './night-hag.js'
import { nightmare } from './nightmare.js'
import { noble } from './noble.js'
import { ochreJelly } from './ochre-jelly.js'
import { octopus } from './octopus.js'
import { ogre } from './ogre.js'
import { ogreZombie } from './ogre-zombie.js'
import { oni } from './oni.js'
import { orc } from './orc.js'
import { otyugh } from './otyugh.js'
import { owl } from './owl.js'
import { owlbear } from './owlbear.js'
import { panther } from './panther.js'
import { pegasus } from './pegasus.js'
import { phaseSpider } from './phase-spider.js'
import { pitFiend } from './pit-fiend.js'
import { planetar } from './planetar.js'
import { plesiosaurus } from './plesiosaurus.js'
import { poisonousSnake } from './poisonous-snake.js'
import { polarBear } from './polar-bear.js'
import { pony } from './pony.js'
import { priest } from './priest.js'
import { pseudodragon } from './pseudodragon.js'
import { purpleWorm } from './purple-worm.js'
import { quasit } from './quasit.js'
import { quipper } from './quipper.js'
import { rakshasa } from './rakshasa.js'
import { rat } from './rat.js'
import { raven } from './raven.js'
import { redDragonWyrmling } from './red-dragon-wyrmling.js'
import { reefShark } from './reef-shark.js'
import { remorhaz } from './remorhaz.js'
import { rhinoceros } from './rhinoceros.js'
import { ridingHorse } from './riding-horse.js'
import { roc } from './roc.js'
import { roper } from './roper.js'
import { rugOfSmothering } from './rug-of-smothering.js'
import { rustMonster } from './rust-monster.js'
import { saberToothedTiger } from './saber-toothed-tiger.js'
import { sahuagin } from './sahuagin.js'
import { salamander } from './salamander.js'
import { satyr } from './satyr.js'
import { scorpion } from './scorpion.js'
import { scout } from './scout.js'
import { seaHag } from './sea-hag.js'
import { seaHorse } from './sea-horse.js'
import { shadow } from './shadow.js'
import { shamblingMound } from './shambling-mound.js'
import { shieldGuardian } from './shield-guardian.js'
import { shrieker } from './shrieker.js'
import { silverDragonWyrmling } from './silver-dragon-wyrmling.js'
import { skeleton } from './skeleton.js'
import { solar } from './solar.js'
import { specter } from './specter.js'
import { spider } from './spider.js'
import { spiritNaga } from './spirit-naga.js'
import { sprite } from './sprite.js'
import { spy } from './spy.js'
import { steamMephit } from './steam-mephit.js'
import { stirge } from './stirge.js'
import { stoneGiant } from './stone-giant.js'
import { stoneGolem } from './stone-golem.js'
import { stormGiant } from './storm-giant.js'
import { succubusIncubus } from './succubus-incubus.js'
import { tarrasque } from './tarrasque.js'
import { thug } from './thug.js'
import { tiger } from './tiger.js'
import { treant } from './treant.js'
import { tribalWarrior } from './tribal-warrior.js'
import { triceratops } from './triceratops.js'
import { troll } from './troll.js'
import { tyrannosaurusRex } from './tyrannosaurus-rex.js'
import { unicorn } from './unicorn.js'
import { vampire } from './vampire.js'
import { vampireSpawn } from './vampire-spawn.js'
import { veteran } from './veteran.js'
import { violetFungus } from './violet-fungus.js'
import { vrock } from './vrock.js'
import { vulture } from './vulture.js'
import { warhorse } from './warhorse.js'
import { warhorseSkeleton } from './warhorse-skeleton.js'
import { waterElemental } from './water-elemental.js'
import { weasel } from './weasel.js'
import { werebear } from './werebear.js'
import { wereboar } from './wereboar.js'
import { wererat } from './wererat.js'
import { weretiger } from './weretiger.js'
import { werewolf } from './werewolf.js'
import { whiteDragonWyrmling } from './white-dragon-wyrmling.js'
import { wight } from './wight.js'
import { willOWisp } from './will-o-wisp.js'
import { winterWolf } from './winter-wolf.js'
import { wolf } from './wolf.js'
import { worg } from './worg.js'
import { wraith } from './wraith.js'
import { wyvern } from './wyvern.js'
import { xorn } from './xorn.js'
import { youngBlackDragon } from './young-black-dragon.js'
import { youngBlueDragon } from './young-blue-dragon.js'
import { youngBrassDragon } from './young-brass-dragon.js'
import { youngBronzeDragon } from './young-bronze-dragon.js'
import { youngCopperDragon } from './young-copper-dragon.js'
import { youngGoldDragon } from './young-gold-dragon.js'
import { youngGreenDragon } from './young-green-dragon.js'
import { youngRedDragon } from './young-red-dragon.js'
import { youngSilverDragon } from './young-silver-dragon.js'
import { youngWhiteDragon } from './young-white-dragon.js'
import { zombie } from './zombie.js'

const rawSrdCreatureRecords = [
  aboleth,
  acolyte,
  adultBlackDragon,
  adultBlueDragon,
  adultBrassDragon,
  adultBronzeDragon,
  adultCopperDragon,
  adultGoldDragon,
  adultGreenDragon,
  adultRedDragon,
  adultSilverDragon,
  adultWhiteDragon,
  airElemental,
  ancientBlackDragon,
  ancientBlueDragon,
  ancientBrassDragon,
  ancientBronzeDragon,
  ancientCopperDragon,
  ancientGoldDragon,
  ancientGreenDragon,
  ancientRedDragon,
  ancientSilverDragon,
  ancientWhiteDragon,
  androsphinx,
  animatedArmor,
  ankheg,
  ape,
  archmage,
  assassin,
  awakenedShrub,
  awakenedTree,
  axeBeak,
  azer,
  baboon,
  badger,
  balor,
  bandit,
  banditCaptain,
  barbedDevil,
  basilisk,
  bat,
  beardedDevil,
  behir,
  berserker,
  blackBear,
  blackDragonWyrmling,
  blackPudding,
  blinkDog,
  bloodHawk,
  blueDragonWyrmling,
  boar,
  boneDevil,
  brassDragonWyrmling,
  bronzeDragonWyrmling,
  brownBear,
  bugbear,
  bulette,
  camel,
  cat,
  centaur,
  chainDevil,
  chimera,
  chuul,
  clayGolem,
  cloaker,
  cloudGiant,
  cockatrice,
  commoner,
  constrictorSnake,
  copperDragonWyrmling,
  couatl,
  crab,
  crocodile,
  cultFanatic,
  cultist,
  darkmantle,
  deathDog,
  deepGnomeSvirfneblin,
  deer,
  deva,
  direWolf,
  djinni,
  doppelganger,
  draftHorse,
  dragonTurtle,
  dretch,
  drider,
  drow,
  druid,
  dryad,
  duergar,
  dustMephit,
  eagle,
  earthElemental,
  efreeti,
  elephant,
  elk,
  erinyes,
  ettercap,
  ettin,
  fireElemental,
  fireGiant,
  fleshGolem,
  flyingSnake,
  flyingSword,
  frog,
  frostGiant,
  gargoyle,
  gelatinousCube,
  ghast,
  ghost,
  ghoul,
  giantApe,
  giantBadger,
  giantBat,
  giantBoar,
  giantCentipede,
  giantConstrictorSnake,
  giantCrab,
  giantCrocodile,
  giantEagle,
  giantElk,
  giantFireBeetle,
  giantFrog,
  giantGoat,
  giantHyena,
  giantLizard,
  giantOctopus,
  giantOwl,
  giantPoisonousSnake,
  giantRat,
  giantScorpion,
  giantSeaHorse,
  giantShark,
  giantSpider,
  giantToad,
  giantVulture,
  giantWasp,
  giantWeasel,
  giantWolfSpider,
  gibberingMouther,
  glabrezu,
  gladiator,
  gnoll,
  goat,
  goblin,
  goldDragonWyrmling,
  gorgon,
  grayOoze,
  greenDragonWyrmling,
  greenHag,
  grick,
  griffon,
  grimlock,
  guard,
  guardianNaga,
  gynosphinx,
  halfRedDragonVeteran,
  harpy,
  hawk,
  hellHound,
  hezrou,
  hillGiant,
  hippogriff,
  hobgoblin,
  homunculus,
  hornedDevil,
  hunterShark,
  hydra,
  hyena,
  iceDevil,
  iceMephit,
  imp,
  invisibleStalker,
  ironGolem,
  jackal,
  killerWhale,
  knight,
  kobold,
  kraken,
  lamia,
  lemure,
  lich,
  lion,
  lizard,
  lizardfolk,
  mage,
  magmaMephit,
  magmin,
  mammoth,
  manticore,
  marilith,
  mastiff,
  medusa,
  merfolk,
  merrow,
  mimic,
  minotaur,
  minotaurSkeleton,
  mule,
  mummy,
  mummyLord,
  nalfeshnee,
  nightHag,
  nightmare,
  noble,
  ochreJelly,
  octopus,
  ogre,
  ogreZombie,
  oni,
  orc,
  otyugh,
  owl,
  owlbear,
  panther,
  pegasus,
  phaseSpider,
  pitFiend,
  planetar,
  plesiosaurus,
  poisonousSnake,
  polarBear,
  pony,
  priest,
  pseudodragon,
  purpleWorm,
  quasit,
  quipper,
  rakshasa,
  rat,
  raven,
  redDragonWyrmling,
  reefShark,
  remorhaz,
  rhinoceros,
  ridingHorse,
  roc,
  roper,
  rugOfSmothering,
  rustMonster,
  saberToothedTiger,
  sahuagin,
  salamander,
  satyr,
  scorpion,
  scout,
  seaHag,
  seaHorse,
  shadow,
  shamblingMound,
  shieldGuardian,
  shrieker,
  silverDragonWyrmling,
  skeleton,
  solar,
  specter,
  spider,
  spiritNaga,
  sprite,
  spy,
  steamMephit,
  stirge,
  stoneGiant,
  stoneGolem,
  stormGiant,
  succubusIncubus,
  tarrasque,
  thug,
  tiger,
  treant,
  tribalWarrior,
  triceratops,
  troll,
  tyrannosaurusRex,
  unicorn,
  vampire,
  vampireSpawn,
  veteran,
  violetFungus,
  vrock,
  vulture,
  warhorse,
  warhorseSkeleton,
  waterElemental,
  weasel,
  werebear,
  wereboar,
  wererat,
  weretiger,
  werewolf,
  whiteDragonWyrmling,
  wight,
  willOWisp,
  winterWolf,
  wolf,
  worg,
  wraith,
  wyvern,
  xorn,
  youngBlackDragon,
  youngBlueDragon,
  youngBrassDragon,
  youngBronzeDragon,
  youngCopperDragon,
  youngGoldDragon,
  youngGreenDragon,
  youngRedDragon,
  youngSilverDragon,
  youngWhiteDragon,
  zombie
]

export const srdCreatureRecords = rawSrdCreatureRecords
  .map(normalizeLegendaryActionOptions)
  .map(applyCreatureEquipmentLoadouts)
export const srdCreatures = srdCreatureRecords
