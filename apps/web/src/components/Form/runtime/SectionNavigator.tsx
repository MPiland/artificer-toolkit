import { Button } from '@mantine/core'
import type { SectionedNodeGroup } from '@artificer-toolkit/shared'
import { sectionNav } from './runtimeStyles.css.ts'

export function SectionNavigator({
  sections,
  activeSectionId,
  onSectionChange
}: {
  sections: SectionedNodeGroup[]
  activeSectionId: string
  onSectionChange: (sectionId: string) => void
}) {
  return (
    <nav className={sectionNav} aria-label='Form sections'>
      {sections.map((section) => (
        <Button
          key={section.id}
          variant={section.id === activeSectionId ? 'filled' : 'subtle'}
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
        </Button>
      ))}
    </nav>
  )
}
