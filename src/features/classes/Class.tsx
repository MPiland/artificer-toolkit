import parse from 'html-react-parser'
import { Fragment } from 'react'
// import { Fragment, MouseEvent as ReactMouseEvent } from 'react'
import { useListClassesQuery } from './classesApi'
import { useLocation } from 'react-router-dom'
import Detail from '../../components/Detail/Detail'
import { sprinkles } from '../../css/sprinkles.css'
import { Class as ClassState, Feature, FeatureOption } from '../../../amplify/API'
import { Attributes, Categories, Prerequisites } from '../../types/enums'
import { useGetSystemQuery } from '../systems/systemsApi'
import { useListSpellsQuery } from '../spells/spellsApi'

const Class = () => {
  const location = useLocation()
  const { data: classes } = useListClassesQuery()
  const { data: system } = useGetSystemQuery()
  const subclasses = classes.filter((uClass) => uClass.parentClass === location.state.item.id)
  const { data: spells } = useListSpellsQuery()

  const uClass: ClassState = location.state.item

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
        if (childReqOption.spellsKnown && childReqOption.spellsKnown?.length > 0) {
          childReqsText.push(
            `Spell(s) Known: ${childReqOption.spellsKnown?.map((spellId, index) => {
              const spell = spells.find((spellItem) => spellItem.id === spellId)
              if (childReqOption.spellsKnown?.length > 1 && index !== childReqOption.spellsKnown?.length - 1) {
                return `${spell.label}, `
              } else {
                return `${spell.label}`
              }
            })}`
          )
        }
        if (childReqOption.featuresKnown && childReqOption.featuresKnown?.length > 0) {
          let featureText = ''
          childReqOption.featuresKnown?.map((featureId, index) => {
            const feature = classItem.features.find((cFeature) => featureId === cFeature.id)
            featureText += `${feature.label}`
            const featureLength = childReqOption.featuresKnown?.length
            if (childReqOption.optionsKnown?.length > 0) {
              childReqOption.optionsKnown?.map((optionId, reqOptionIndex) => {
                const optionLength = childReqOption.optionsKnown?.length
                const option = feature.options?.find((fOption) => fOption.id === optionId)
                if (option) {
                  if (featureLength > 1 && reqOptionIndex !== optionLength - 1) {
                    featureText += `: ${option.value}, `
                  } else {
                    featureText += `: ${option.value}`
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

  // const scrollToElement = (e: ReactMouseEvent<HTMLLIElement | HTMLAnchorElement, MouseEvent>, id: string) => {
  //   const element = document.getElementById(`${id}`)
  //   e.preventDefault()
  //   if (element) {
  //     element.scrollIntoView({
  //       behavior: 'smooth',
  //       block: 'start',
  //     })
  //   }
  // }

  let resourceShown = false

  // const sidebarList =
  //   uClass?.category === Categories.base ? (
  //     <>
  //       {uClass?.details?.length > 0 &&
  //         uClass?.details.map((detail, index) => (
  //           <li
  //             key={index}
  //             onClick={(e) => {
  //               scrollToElement(e, detail.value)
  //             }}
  //           >
  //             <a href='/'>{detail?.label}</a>
  //           </li>
  //         ))}
  //       {subclasses?.length > 0 && (
  //         <>
  //           {subclasses.map((subclass, index) => (
  //             <li
  //               onClick={(e) => {
  //                 scrollToElement(e, subclass.value)
  //               }}
  //               key={index}
  //             >
  //               <a href='/'>{subclass.label}</a>
  //             </li>
  //           ))}
  //         </>
  //       )}
  //       {uClass?.features?.find((feature) => feature?.category === Categories.subclass) && (
  //         <li
  //           onClick={(e) => {
  //             scrollToElement(e, uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.value)
  //           }}
  //         >
  //           <a href='/'>{`${uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}`}</a>
  //         </li>
  //       )}
  //       {subclasses.length > 0 &&
  //         subclasses.map((subclass, index) => (
  //           <li key={index}>
  //             <a
  //               href='/'
  //               onClick={(e) => {
  //                 scrollToElement(e, subclass.value)
  //               }}
  //             >
  //               {subclass.label}
  //             </a>
  //           </li>
  //         ))}
  //     </>
  //   ) : (
  //     <>
  //       {uClass?.features?.length > 0 &&
  //         uClass?.features.map((feature, fIndex) => (
  //           <li key={fIndex}>
  //             <a
  //               href='/'
  //               className='sidebar-link'
  //               onClick={(e) => {
  //                 scrollToElement(e, feature.value)
  //               }}
  //             >
  //               {feature.value}
  //             </a>
  //           </li>
  //         ))}
  //     </>
  //   )

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
              <section id={`${detail.value}`} key={index}>
                <strong>
                  <h2>{detail.label}</h2>
                </strong>
                <hr />
                {detail.desc && parse(detail.desc)}
                {index === uClass?.details.length - 1 &&
                  uClass?.features?.length > 0 &&
                  uClass?.features.map((feature, fIndex: number) => {
                    const featureLevelArray = feature.levelAvailable?.split(', ')
                    if (featureLevelArray) {
                      const featureLevel = featureLevelArray[0]
                      return (
                        <Fragment key={fIndex}>
                          {uClass?.resource &&
                            Number(featureLevel) >= uClass?.resource?.levelAvailable &&
                            !resourceShown && (
                              <Fragment>
                                <h3>
                                  <strong>{uClass?.resource?.value}</strong>
                                </h3>
                                {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                                {(resourceShown = true)}
                              </Fragment>
                            )}
                          <h3>
                            <strong>{feature.value}</strong>
                          </h3>
                          {feature.desc && parse(feature.desc)}
                          {feature.options?.length > 0 &&
                            feature.options.map((option, oIndex) => (
                              <Fragment key={oIndex}>
                                <h4>
                                  <strong>{option.value}</strong>
                                </h4>
                                {feature.attributes.some((attribute) => attribute === Attributes.prerequisites) &&
                                  feature.prerequisites.options.some(
                                    (reqId) =>
                                      reqId === Prerequisites.abilityScore ||
                                      reqId === Prerequisites.skillProficiency ||
                                      reqId === Prerequisites.spellsKnown ||
                                      reqId === Prerequisites.featuresKnown
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
              </section>
            ))}
          {uClass?.features?.find((feature) => feature?.category === Categories.subclass) && (
            <section id={`${uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.value}`}>
              <h2>
                <strong>{uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.label}</strong>
              </h2>
              <hr />
              {uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.detail &&
                parse(uClass?.features?.find((feature) => feature?.category === Categories.subclass)?.detail)}
            </section>
          )}
          {subclasses.length > 0 && (
            <>
              {subclasses.map((subclass, index) => {
                let subclassResourceShown = false
                return (
                  <section id={`${subclass.value}`} key={index}>
                    <h2>
                      <strong>{subclass.value}</strong>
                    </h2>
                    <hr />
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
                                  <h3>
                                    <strong>{subclass.resource?.value}</strong>
                                  </h3>
                                  {subclass.resource?.desc && parse(subclass.resource?.desc)}
                                  {(subclassResourceShown = true)}
                                </Fragment>
                              )}
                            <h3>
                              <strong>{feature.value}</strong>
                            </h3>
                            {feature.desc && parse(feature.desc)}
                            {feature.options?.length > 0 &&
                              feature.options.map((option, oIndex) => (
                                <Fragment key={oIndex}>
                                  <h4>
                                    <strong>{option.value}</strong>
                                  </h4>
                                  {feature.attributes.some((attribute) => attribute === Attributes.prerequisites) &&
                                    feature.prerequisites.options.some(
                                      (reqId) =>
                                        reqId === Prerequisites.abilityScore ||
                                        reqId === Prerequisites.skillProficiency ||
                                        reqId === Prerequisites.spellsKnown ||
                                        reqId === Prerequisites.featuresKnown
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
                  </section>
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
                        <h3>
                          <strong>{uClass?.resource?.value}</strong>
                        </h3>
                        {uClass?.resource?.desc && parse(uClass?.resource?.desc)}
                        {(resourceShown = true)}
                      </Fragment>
                    )}
                    <h3>
                      <strong>{feature.value}</strong>
                    </h3>
                    {feature.desc && parse(feature.desc)}
                    {feature.options?.length > 0 &&
                      feature.options.map((option, oIndex) => (
                        <Fragment key={oIndex}>
                          <h4>
                            <strong>{option.value}</strong>
                          </h4>
                          {feature.attributes.some((attribute) => attribute === Attributes.prerequisites) &&
                            feature.prerequisites.options.some(
                              (reqId) =>
                                reqId === Prerequisites.abilityScore ||
                                reqId === Prerequisites.skillProficiency ||
                                reqId === Prerequisites.spellsKnown ||
                                reqId === Prerequisites.featuresKnown
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
