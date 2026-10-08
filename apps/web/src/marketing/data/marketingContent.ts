import {
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING
} from '@artificer-toolkit/shared/account/entitlements'

const marketingPricingEnabled = false

const pricingNavigation = marketingPricingEnabled
  ? ([{ label: 'Pricing', href: '#pricing' }] as const)
  : []

const marketingNavigation = [
  { label: 'Features', href: '#features' },
  ...pricingNavigation,
  { label: 'Sign in', href: '/sign-in' }
] as const

export function getMarketingNavigation(publicSignUpEnabled: boolean) {
  return publicSignUpEnabled
    ? marketingNavigation
    : marketingNavigation.filter((item) => item.href !== '#pricing')
}

type MarketingSectionHash = '#features' | '#pricing'

export function isMarketingSectionEnabled(hash: MarketingSectionHash) {
  return marketingNavigation.some((item) => item.href === hash)
}

export const marketingHeroHighlights = [
  {
    label: 'Homebrew',
    copy: 'Create spells, classes, equipment, creatures, and more one section at a time'
  },
  {
    label: 'Characters',
    copy: 'Use SRD content and your homebrew in Character Builder'
  },
  {
    label: 'At the table',
    copy: 'Keep actions, spells, resources, and inventory ready during a session'
  }
] as const

export const marketingFeatures = [
  {
    audience: 'For players',
    title: 'Build a character, then play from the sheet',
    copy: 'Use guided steps to build your character, then open actions, spells, resources, and inventory on the Character Sheet.',
    bullets: [
      'Review your choices before finishing the build',
      'Track the character during a session'
    ],
    icon: 'character'
  },
  {
    audience: 'For homebrewers',
    title: 'Author homebrew one section at a time',
    copy: 'Create spells, equipment, races, classes, creatures, and vehicles without digging through one long form.',
    bullets: ['Save your work as a draft', 'Review each section before activation'],
    icon: 'scroll'
  },
  {
    audience: 'For reference',
    title: 'Keep SRD rules and your work in one Library',
    copy: 'Browse SRD content for reference, or copy a read-only entry when you want your own editable version.',
    bullets: [
      'Find spells, creatures, equipment, and rules',
      'Keep SRD content separate from your own version'
    ],
    icon: 'book'
  },
  {
    audience: 'For creators',
    title: 'Edit drafts without changing active content',
    copy: 'Save and review changes as a draft, then activate the content when it is ready for play.',
    bullets: [
      'Keep the current version available while you edit',
      'Choose when the draft replaces it'
    ],
    icon: 'status'
  }
] as const

const free = ENTITLEMENT_LIMITS.FREE
const gm = ENTITLEMENT_LIMITS.GM
const proGm = ENTITLEMENT_LIMITS.PRO_GM
const monthlyPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

export const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Build Characters and homebrew, and host your first table.',
    cta: 'Get started for free',
    href: '/sign-up',
    featured: false,
    features: [
      `Up to ${free.personalCharacters} Characters and ${free.homebrewRoots} homebrew roots`,
      `${free.activeHostedCampaigns} hosted Campaign with ${free.playerSeatsPerCampaign} player seats`,
      `${free.campaignEntriesPerCampaign} entries and ${free.scenesPerCampaign} Scenes per Campaign`,
      '100 MB of media storage'
    ]
  },
  {
    name: 'Player',
    price: monthlyPrice(ENTITLEMENT_PRICING.PLAYER.monthlyPriceCents),
    cadence: '/month',
    description: 'Unlimited Characters and homebrew for players who build.',
    cta: 'Choose Player',
    href: '/sign-up',
    featured: false,
    features: [
      'Everything in Free',
      'Unlimited Characters and homebrew',
      '1 GB of media storage',
      'Join any number of Campaigns'
    ]
  },
  {
    name: 'GM',
    price: monthlyPrice(ENTITLEMENT_PRICING.GM.monthlyPriceCents),
    cadence: '/month',
    description: 'Room to run several tables and build whole worlds.',
    cta: 'Choose GM',
    href: '/sign-up',
    featured: true,
    features: [
      'Everything in Player',
      `${gm.activeHostedCampaigns} hosted Campaigns with ${gm.playerSeatsPerCampaign} seats each`,
      'Unlimited Campaign entries, Scenes and saved Encounters',
      '5 GB of media storage',
      `Paid tables with a ${gm.platformFeeBasisPoints / 100}% platform fee`
    ]
  },
  {
    name: 'Pro GM',
    price: monthlyPrice(ENTITLEMENT_PRICING.PRO_GM.monthlyPriceCents),
    cadence: '/month',
    description: 'For professional GMs who run paid tables.',
    cta: 'Choose Pro GM',
    href: '/sign-up',
    featured: false,
    features: [
      'Everything in GM',
      `${proGm.activeHostedCampaigns} hosted Campaigns`,
      '25 GB of media storage',
      `Paid tables with a ${proGm.platformFeeBasisPoints / 100}% platform fee`
    ]
  }
] as const
