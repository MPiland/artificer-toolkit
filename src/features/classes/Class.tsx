import parse from 'html-react-parser'
import { Fragment } from 'react'
// import { Fragment, MouseEvent as ReactMouseEvent } from 'react'
import { useListClassesQuery } from './classesApi'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { sprinkles } from '../../css/sprinkles.css'
import { Class as ClassState, Feature, FeatureOption } from '../../../amplify/gql/types'
import { Attributes, Categories, Prerequisites } from '../../types/enums'
import { useGetSystemQuery } from '../systems/systemsApi'
import { useListSpellsQuery } from '../spells/spellsApi'
import { class_section_divider } from './Class.css'

const Class = () => {
  const location = useLocation()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()
  const { data: spells } = useListSpellsQuery()

  const uClass: ClassState = location.state.item

  const subclasses = classes.filter((sClass) => {
    return sClass.parentClass === uClass.id
  })

  const handlePreReq = (parentItem: Feature, childItem: FeatureOption, classItem: ClassState) => {
    const parentLevel = parentItem.levelAvailable.split(', ')
    const childLevel = childItem.levelAvailable
    const childReq = childItem.attributes?.some((attribute) => attribute === Attributes.prerequisites)
    const childReqsText = []

    if (childLevel !== parentLevel[0]) {
      childReqsText.push(`Class level ${childLevel}`)
    }

    if (childReq) {
      const childReqOption = childItem.prerequisites
      if (childReqOption && childReqOption.options?.length > 0) {
        if (childReqOption.skillProficiencies && childReqOption.skillProficiencies?.length > 0) {
          childReqsText.push(
            `Skill(s) Proficiency: ${childReqOption.skillProficiencies?.map((skillId, index) => {
              const skill = system.skills.find((sSkill) => sSkill.id === skillId)
              if (
                childReqOption.skillProficiencies?.length > 1 &&
                index !== childReqOption.skillProficiencies?.length - 1
              ) {
                return `${skill.label}, `
              } else {
                return `${skill.label}`
              }
            })}`
          )
        }
        if (childReqOption.abilityScore && childReqOption.abilityScore?.abilities?.length > 0) {
          childReqsText.push(
            `Ability Score: ${childReqOption.abilityScore?.abilities.map((abilityId, index) => {
              const ability = system.abilities.find((abilityItem) => abilityItem.id === abilityId)
              if (
                childReqOption.abilityScore?.abilities?.length > 1 &&
                index !== childReqOption.abilityScore?.abilities?.length - 1
              ) {
                return `(${childReqOption.abilityScore?.score}) ${ability.label}, `
              } else {
                return `(${childReqOption.abilityScore?.score}) ${ability.label}`
              }
            })}`
          )
        }
        if (childReqOption.spellsObtained && childReqOption.spellsObtained?.length > 0) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellsObtained?.map((spellId, index) => {
              const spell = spells.find((spellItem) => spellItem.id === spellId)
              if (childReqOption.spellsObtained?.length > 1 && index !== childReqOption.spellsObtained?.length - 1) {
                return `${spell.label}, `
              } else {
                return `${spell.label}`
              }
            })}`
          )
        }
        if (childReqOption.featuresObtained && childReqOption.featuresObtained?.length > 0) {
          let featureText = ''
          childReqOption.featuresObtained?.map((featureId, index) => {
            const feature = classItem.features.find((cFeature) => featureId === cFeature.id)
            featureText += `${feature.label}`
            const featureLength = childReqOption.featuresObtained?.length
            if (childReqOption.optionsObtained?.length > 0) {
              childReqOption.optionsObtained?.map((optionId, reqOptionIndex) => {
                const optionLength = childReqOption.optionsObtained?.length
                const option = feature.options?.find((fOption) => fOption.id === optionId)
                if (option) {
                  if (featureLength > 1 && reqOptionIndex !== optionLength - 1) {
                    featureText += `: ${option.label}, `
                  } else {
                    featureText += `: ${option.label}`
                  }
                }
              })
            } else {
              if (featureLength > 1 && index !== featureLength - 1) {
                featureText += '; '
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
    <Detail footerSpacing='end'>
      <div id='quote'>
        <em>{uClass?.desc && parse(uClass?.desc)}</em>
      </div>
      {uClass?.category === Categories.base ? (
        <>
          {uClass?.details &&
            uClass?.details?.length > 0 &&
            uClass?.details.map((detail, index) => (
              <Fragment key={index}>
                <h1>{detail.label}</h1>
                <hr className={class_section_divider} />
                {detail.desc && parse(detail.desc)}
                {index === uClass?.details.length - 1 &&
                  uClass?.features?.length > 0 &&
                  uClass?.features.map((feature, fIndex) => {
                    const featureLevelArray = feature.levelAvailable?.split(', ')
                    if (featureLevelArray) {
                      const featureLevel = featureLevelArray[0]
                      return (
                        <Fragment key={fIndex}>
                          {uClass?.resource &&
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
                          {feature.options?.length > 0 &&
                            feature.options.map((option, oIndex) => (
                              <Fragment key={oIndex}>
                                <h3>{option.label}</h3>
                                {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                                  feature.prerequisites.options.some(
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
              </Fragment>
            ))}
          {uClass?.features?.find((feature) => feature?.category === Categories.subclass) && (
            <div id={`${uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}`}>
              <h1>{uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}</h1>
              <hr className={class_section_divider} />
              {uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.detail &&
                parse(uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.detail)}
            </div>
          )}
          {subclasses.length > 0 && (
            <>
              {subclasses.map((subclass, index) => {
                let subclassResourceShown = false
                return (
                  <Fragment key={index}>
                    <h2>{subclass.label}</h2>
                    <hr className={class_section_divider} />
                    {subclass.desc && parse(subclass.desc)}
                    {subclass.features?.length > 0 &&
                      subclass.features.map((feature, fIndex) => {
                        const featureLevelArray = feature.levelAvailable?.split(', ')
                        const featureLevel = featureLevelArray[0]
                        return (
                          <Fragment key={fIndex}>
                            {subclass.resource &&
                              Number(featureLevel) >= subclass.resource?.levelAvailable &&
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
                            {feature.options?.length > 0 &&
                              feature.options.map((option, oIndex) => (
                                <Fragment key={oIndex}>
                                  <h3>{option.value}</h3>
                                  {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                                    feature.prerequisites.options.some(
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
                                  {option.desc && parse(option.desc)}
                                </Fragment>
                              ))}
                          </Fragment>
                        )
                      })}
                    {index !== subclasses.length - 1 && <hr />}
                  </Fragment>
                )
              })}
            </>
          )}
        </>
      ) : (
        <>
          {uClass?.features?.length > 0 &&
            uClass?.features.map((feature, fIndex) => {
              const featureLevelArray = feature.levelAvailable?.split(', ')
              if (featureLevelArray) {
                const featureLevel = featureLevelArray[0] ?? 0
                return (
                  <Fragment key={fIndex}>
                    {uClass?.resource && Number(featureLevel) >= uClass?.resource?.levelAvailable && !resourceShown && (
                      <Fragment>
                        <h2>{uClass?.resource?.label}</h2>
                        {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                        {(resourceShown = true)}
                      </Fragment>
                    )}
                    <h2>{feature.label}</h2>
                    {feature.desc && parse(feature.desc)}
                    {feature.options?.length > 0 &&
                      feature.options.map((option, oIndex) => (
                        <Fragment key={oIndex}>
                          <h3>{option.value}</h3>
                          {feature.attributes?.some((attribute) => attribute === Attributes.prerequisites) &&
                            feature.prerequisites.options.some(
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
      )}
    </Detail>
  )
}

export default Class
