import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  MarketingFeatureSection,
  MarketingHero,
  MarketingPage,
  MarketingPricingSection,
  PublicSiteFooter,
  PublicSiteHeader
} from './PublicSite'

const meta = {
  title: 'Public/Marketing',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Page: Story = {
  render: () => <MarketingPage />
}

export const Header: Story = {
  render: () => <PublicSiteHeader />
}

export const Hero: Story = {
  render: () => <MarketingHero />
}

export const Features: Story = {
  render: () => <MarketingFeatureSection />
}

export const Pricing: Story = {
  render: () => <MarketingPricingSection />
}

export const Footer: Story = {
  render: () => <PublicSiteFooter />
}
