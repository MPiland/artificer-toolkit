import IBook from '#assets/icons/IBook'
import IChar from '#assets/icons/IChar'
import IClass from '#assets/icons/IClass'
import ILogo from '#assets/icons/ILogo'
import IRaces from '#assets/icons/IRaces'
import IScroll from '#assets/icons/IScroll'
import {
  heroMockup,
  mockupBody,
  mockupBrand,
  mockupBrandIcon,
  mockupContent,
  mockupField,
  mockupFieldGrid,
  mockupFieldLabel,
  mockupFieldValue,
  mockupHeader,
  mockupKicker,
  mockupListMeta,
  mockupListRow,
  mockupListRowActive,
  mockupListRows,
  mockupListTitle,
  mockupPill,
  mockupRail,
  mockupSheetStats,
  mockupStage,
  mockupStat,
  mockupStatLabel,
  mockupStatValue,
  mockupSurface,
  mockupSurfaceEditor,
  mockupSurfaceLabel,
  mockupSurfaceList,
  mockupSurfaceSheet,
  mockupSurfaceTop,
  mockupTextAreaValue,
  mockupTopbar,
  mockupTopNav,
  mockupTopNavItem,
  mockupTopNavItemActive,
  mockupTopStatus,
  mockupTraffic,
  mockupTrafficDot,
  railDot,
  railDotActive,
  sectionCopy,
  sectionTitle
} from '../marketing.css'

export function AppMockup() {
  return (
    <div
      className={heroMockup}
      role='img'
      aria-label='Preview showing a content list, an authoring surface, and a character sheet working together'
    >
      <div className={mockupTopbar} aria-hidden='true'>
        <div className={mockupBrand}>
          <ILogo className={mockupBrandIcon} />
          <span>Artificer Toolkit</span>
        </div>
        <div className={mockupTopNav} aria-hidden='true'>
          <span className={`${mockupTopNavItem} ${mockupTopNavItemActive}`}>Characters</span>
          <span className={mockupTopNavItem}>Homebrew</span>
          <span className={mockupTopNavItem}>Campaigns</span>
        </div>
        <div className={mockupTopStatus}>
          <span>Desktop + mobile ready</span>
        </div>
      </div>

      <div className={mockupBody} aria-hidden='true'>
        <div className={mockupRail} aria-hidden='true'>
          <IChar className={railDotActive} />
          <IScroll className={railDot} />
          <IBook className={railDot} />
          <IRaces className={railDot} />
          <IClass className={railDot} />
        </div>

        <div className={mockupContent}>
          <div className={mockupHeader}>
            <span className={mockupKicker}>Creation to play</span>
            <h2 className={sectionTitle}>Create it, organize it, then use it in play</h2>
            <p className={sectionCopy}>
              Authored content, character work, and play-state surfaces stay connected instead of
              living in separate apps.
            </p>
          </div>
          <div className={mockupStage}>
            <div className={`${mockupSurface} ${mockupSurfaceList}`}>
              <div className={mockupSurfaceTop}>
                <span className={mockupSurfaceLabel}>Content list</span>
                <span className={mockupPill}>Owned + SRD</span>
              </div>
              <div className={mockupListRows}>
                <div className={`${mockupListRow} ${mockupListRowActive}`}>
                  <IScroll className={railDot} />
                  <div>
                    <div className={mockupListTitle}>Stormbound Strike</div>
                    <div className={mockupListMeta}>Spell / Owned draft / Ready to edit</div>
                  </div>
                  <span className={mockupPill}>Edit</span>
                </div>
                <div className={mockupListRow}>
                  <IClass className={railDot} />
                  <div>
                    <div className={mockupListTitle}>Warden</div>
                    <div className={mockupListMeta}>Class / Master copy available</div>
                  </div>
                  <span className={mockupPill}>Copy</span>
                </div>
                <div className={mockupListRow}>
                  <IRaces className={railDot} />
                  <div>
                    <div className={mockupListTitle}>Ashborn</div>
                    <div className={mockupListMeta}>Race / Shared with campaign</div>
                  </div>
                  <span className={mockupPill}>View</span>
                </div>
              </div>
            </div>

            <div className={`${mockupSurface} ${mockupSurfaceEditor}`}>
              <div className={mockupSurfaceTop}>
                <div className={mockupTraffic} aria-hidden='true'>
                  <span className={mockupTrafficDot} />
                  <span className={mockupTrafficDot} />
                  <span className={mockupTrafficDot} />
                </div>
                <span className={mockupSurfaceLabel}>Spell authoring</span>
                <span className={mockupPill}>Draft</span>
              </div>
              <div className={mockupFieldGrid}>
                <div className={mockupField}>
                  <span className={mockupFieldLabel}>Name</span>
                  <div className={mockupFieldValue}>Stormbound Strike</div>
                </div>
                <div className={mockupField}>
                  <span className={mockupFieldLabel}>School</span>
                  <div className={mockupFieldValue}>Evocation</div>
                </div>
                <div className={mockupField}>
                  <span className={mockupFieldLabel}>Level</span>
                  <div className={mockupFieldValue}>3</div>
                </div>
                <div className={mockupField}>
                  <span className={mockupFieldLabel}>Casting time</span>
                  <div className={mockupFieldValue}>1 Action</div>
                </div>
              </div>
              <div className={mockupField}>
                <span className={mockupFieldLabel}>Description</span>
                <div className={mockupTextAreaValue}>
                  Call a focused line of thunder through your weapon, then carry that effect into
                  the character who prepares it.
                </div>
              </div>
            </div>

            <div className={`${mockupSurface} ${mockupSurfaceSheet}`}>
              <div className={mockupSurfaceTop}>
                <span className={mockupSurfaceLabel}>Character sheet</span>
                <span className={mockupPill}>In play</span>
              </div>
              <div className={mockupSheetStats}>
                <div className={mockupStat}>
                  <span className={mockupStatValue}>18</span>
                  <span className={mockupStatLabel}>AC</span>
                </div>
                <div className={mockupStat}>
                  <span className={mockupStatValue}>42</span>
                  <span className={mockupStatLabel}>HP</span>
                </div>
                <div className={mockupStat}>
                  <span className={mockupStatValue}>+7</span>
                  <span className={mockupStatLabel}>Attack</span>
                </div>
                <div className={mockupStat}>
                  <span className={mockupStatValue}>3</span>
                  <span className={mockupStatLabel}>Slots</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
