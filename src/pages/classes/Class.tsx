import parse from 'html-react-parser'
import { Fragment } from 'react'
import Detail from '@/components/Detail/Detail'
import { sprinkles } from '@/css/sprinkles.css'
import { type Class as ClassState, type Feature, type FeatureOption } from '@/types/types'
import { Attributes, Categories, Prerequisites } from '@/types/enums'
import { class_section_divider } from './Class.css'
import { Route } from '@/routes/_protected/classes/$classId'
import useSystemData from '@/hooks/useSystemData'
import useSpellData from '@/hooks/useSpellData'
import useClassData from '@/hooks/useClassData'

const Class = () => {
  const classId = Route.useParams({ select: (r) => r.classId })
  const {
    spells: { findSpell },
  } = useSpellData()
  const systemData = useSystemData()!
  const {
    classes: { findClass },
    subclasses: { findByParent },
  } = useClassData()

  const uClass = findClass(classId)

  if (!uClass || uClass.__typename !== 'Class') return <div>Invalid or missing class data</div>

  const subclasses = findByParent(uClass.id)

  const handlePreReq = (parentItem: Feature, childItem: FeatureOption, classItem: ClassState) => {
    const parentLevel = parentItem?.levelAvailable?.split(', ')
    const childLevel = childItem.levelAvailable
    const childReq = childItem.attributes?.some((attribute) => attribute === Attributes.prerequisites)
    const childReqsText = []

    if (childLevel !== parentLevel?.[0]) {
      childReqsText.push(`Class level ${childLevel}`)
    }

    if (childReq) {
      const childReqOption = childItem.prerequisites
      if (childReqOption && childReqOption.options?.length) {
        if (childReqOption.skillProficiencies && childReqOption.skillProficiencies?.length > 0) {
          childReqsText.push(
            `Skill(s) Proficiency: ${childReqOption.skillProficiencies?.map((id, index) => {
              const skill = systemData.skills.findSkill(id)
              if (skill) {
                if (
                  childReqOption.skillProficiencies?.length &&
                  childReqOption.skillProficiencies?.length > 1 &&
                  index !== childReqOption.skillProficiencies?.length - 1
                ) {
                  return `${skill.label}, `
                } else {
                  return `${skill.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.abilityScore && childReqOption.abilityScore?.abilities?.length) {
          childReqsText.push(
            `Ability Score: ${childReqOption.abilityScore?.abilities.map((id, index) => {
              const ability = systemData.abilities.findAbility(id)
              if (ability) {
                if (
                  childReqOption.abilityScore?.abilities &&
                  childReqOption.abilityScore?.abilities?.length > 1 &&
                  index !== childReqOption.abilityScore?.abilities?.length - 1
                ) {
                  return `(${childReqOption.abilityScore?.score}) ${ability.label}, `
                } else {
                  return `(${childReqOption.abilityScore?.score}) ${ability.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.spellsObtained && childReqOption.spellsObtained?.length > 0) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellsObtained?.map((id, index) => {
              const spell = findSpell(id)
              if (spell) {
                if (
                  childReqOption.spellsObtained?.length &&
                  childReqOption.spellsObtained?.length > 1 &&
                  index !== childReqOption.spellsObtained?.length - 1
                ) {
                  return `${spell.label}, `
                } else {
                  return `${spell.label}`
                }
              }
            })}`
          )
        }
        if (childReqOption.featuresObtained && childReqOption.featuresObtained?.length > 0) {
          let featureText = ''
          childReqOption.featuresObtained?.map((featureId, index) => {
            const feature = classItem.features?.find((cFeature) => featureId === cFeature?.id)
            if (feature) {
              featureText += `${feature.label}`
              const featureLength = childReqOption.featuresObtained?.length
              if (childReqOption.optionsObtained?.length && childReqOption.optionsObtained?.length > 0) {
                childReqOption.optionsObtained?.map((optionId, reqOptionIndex) => {
                  const optionLength = childReqOption.optionsObtained?.length
                  const option = feature.options?.find((fOption) => fOption?.id === optionId)
                  if (option) {
                    if (featureLength && optionLength && featureLength > 1 && reqOptionIndex !== optionLength - 1) {
                      featureText += `: ${option.label}, `
                    } else {
                      featureText += `: ${option.label}`
                    }
                  }
                })
              } else {
                if (featureLength && featureLength > 1 && index !== featureLength - 1) {
                  featureText += '; '
                }
              }
            }
          })
          childReqsText.push(featureText)
        }
      }
    }
    if (childReqsText?.length > 0) {
      let reqText = 'Prerequisite(s) - '
      childReqsText.map((reqItem, reqIndex) => {
        if (childReqsText.length > 1 && reqIndex !== childReqsText.length - 1) {
          reqText += `${reqItem} / `
        } else {
          reqText += `${reqItem}`
        }
      })
      return reqText
    } else {
      return null
    }
  }

  let resourceShown = false

  return (
    <Detail footerSpacing='end' item={uClass}>
      <div id='quote'>
        <em>{uClass?.desc && parse(uClass?.desc)}</em>
      </div>
      {uClass?.category === Categories.base ?
        <>
          {uClass?.details &&
            uClass?.details?.length > 0 &&
            uClass?.details.map((detail, index) => (
              <Fragment key={index}>
                <h1>{detail?.label}</h1>
                <hr className={class_section_divider} />
                {detail?.desc && parse(detail.desc)}
                {uClass?.details?.length &&
                  index === uClass?.details?.length - 1 &&
                  uClass?.features?.length &&
                  uClass?.features.map((feature, fIndex) => {
                    const featureLevelArray = feature.levelAvailable?.split(', ')
                    if (featureLevelArray) {
                      const featureLevel = featureLevelArray[0]
                      return (
                        <Fragment key={fIndex}>
                          {uClass?.resource &&
                            uClass?.resource?.levelAvailable &&
                            Number(featureLevel) >= uClass?.resource?.levelAvailable &&
                            !resourceShown && (
                              <Fragment>
                                <h2>{uClass?.resource?.label}</h2>
                                {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                                {(resourceShown = true)}
                              </Fragment>
                            )}
                          <h2>
                            <u>{feature.label}</u>
                          </h2>
                          {feature.desc && parse(feature.desc)}
                          {feature.options?.length &&
                            feature.options.map((option, oIndex) => (
                              <Fragment key={oIndex}>
                                <h3>{option?.label}</h3>
                                {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                                  feature?.prerequisites?.options?.some(
                                    (reqId) =>
                                      reqId === Prerequisites.abilityScore ||
                                      reqId === Prerequisites.skillProficiency ||
                                      reqId === Prerequisites.spellsObtained ||
                                      reqId === Prerequisites.featuresObtained
                                  ) &&
                                  option && (
                                    <p>
                                      <em className={sprinkles({ mb: 'space-3' })}>
                                        <u>{handlePreReq(feature, option, uClass)}</u>
                                      </em>
                                    </p>
                                  )}
                                {option?.desc && parse(option.desc)}
                              </Fragment>
                            ))}
                        </Fragment>
                      )
                    }
                  })}
              </Fragment>
            ))}
          {uClass?.features?.find((feature) => {
            if (feature?.category === Categories.subclass) {
              const detail = uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.detail
              return (
                <div id={`${uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}`}>
                  <h1>{uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}</h1>
                  <hr className={class_section_divider} />
                  {detail && parse(detail)}
                </div>
              )
            }
          })}
          {subclasses?.length && (
            <>
              {subclasses.map((s, index) => {
                const subclass = findClass(s.id)
                let subclassResourceShown = false
                if (subclass) {
                  return (
                    <Fragment key={index}>
                      <h2>{subclass.label}</h2>
                      <hr className={class_section_divider} />
                      {subclass.desc && parse(subclass.desc)}
                      {subclass?.features?.length &&
                        subclass.features.map((feature, fIndex) => {
                          const featureLevelArray = feature.levelAvailable?.split(', ')
                          const featureLevel = featureLevelArray?.[0]
                          return (
                            <Fragment key={fIndex}>
                              {subclass.resource &&
                                subclass?.resource?.levelAvailable &&
                                Number(featureLevel) >= subclass?.resource?.levelAvailable &&
                                !subclassResourceShown && (
                                  <Fragment>
                                    <h2>{subclass.resource?.value}</h2>
                                    {subclass.resource?.desc && parse(subclass.resource?.desc)}
                                    {(subclassResourceShown = true)}
                                  </Fragment>
                                )}
                              <h2>
                                <u>{feature.label}</u>
                              </h2>
                              {feature.desc && parse(feature.desc)}
                              {feature.options?.length &&
                                feature.options.map((option, oIndex) => (
                                  <Fragment key={oIndex}>
                                    <h3>{option.value}</h3>
                                    {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                                      feature?.prerequisites?.options?.some(
                                        (reqId) =>
                                          reqId === Prerequisites.abilityScore ||
                                          reqId === Prerequisites.skillProficiency ||
                                          reqId === Prerequisites.spellsObtained ||
                                          reqId === Prerequisites.featuresObtained
                                      ) && (
                                        <p>
                                          <em className={sprinkles({ mb: 'space-3' })}>
                                            <u>{handlePreReq(feature, option, subclass)}</u>
                                          </em>
                                        </p>
                                      )}
                                    {option?.desc && parse(option.desc)}
                                  </Fragment>
                                ))}
                            </Fragment>
                          )
                        })}
                      {index !== subclasses.length - 1 && <hr />}
                    </Fragment>
                  )
                }
              })}
            </>
          )}
        </>
      : <>
          {uClass?.features?.length &&
            uClass?.features.map((feature, fIndex) => {
              const featureLevelArray = feature.levelAvailable?.split(', ')
              if (featureLevelArray) {
                const featureLevel = featureLevelArray[0] ?? 0
                return (
                  <Fragment key={fIndex}>
                    {uClass?.resource?.levelAvailable &&
                      uClass?.resource &&
                      Number(featureLevel) >= uClass?.resource?.levelAvailable &&
                      !resourceShown && (
                        <Fragment>
                          <h2>{uClass?.resource?.label}</h2>
                          {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                          {(resourceShown = true)}
                        </Fragment>
                      )}
                    <h2>{feature.label}</h2>
                    {feature.desc && parse(feature.desc)}
                    {feature.options?.length &&
                      feature.options.map((option, oIndex) => (
                        <Fragment key={oIndex}>
                          <h3>{option.value}</h3>
                          {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                            feature?.prerequisites?.options?.some(
                              (reqId) =>
                                reqId === Prerequisites.abilityScore ||
                                reqId === Prerequisites.skillProficiency ||
                                reqId === Prerequisites.spellsObtained ||
                                reqId === Prerequisites.featuresObtained
                            ) && (
                              <p>
                                <em className={sprinkles({ mb: 'space-3' })}>
                                  <u>{handlePreReq(feature, option, uClass)}</u>
                                </em>
                              </p>
                            )}
                          {option.desc && parse(option.desc)}
                        </Fragment>
                      ))}
                  </Fragment>
                )
              }
            })}
        </>
      }
    </Detail>
  )
}

export default Class
