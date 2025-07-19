import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const data = [
  '../backgrounds/backgrounds.json',
  '../classes/base/classes.json',
  '../classes/sub/subclasses.json',
  '../equipment/equipment.json',
  '../spells/spells.json',
  '../races/races.json',
  '../feats/feats.json',
]

data.forEach((filepath) => {
  const fileData = JSON.parse(fs.readFileSync(filepath, 'utf8'))

  fileData.map((item) => {
    if (!item.id) {
      item.id = uuidv4()
    }
    if (!item.owner) {
      item.ownerId = 'master'
    }
    if (!item.createdAt) {
      item.createdAt = '2024-09-12T11:05:10.351Z'
    }
    if (!item.updatedAt) {
      item.updatedAt = '2024-09-12T11:05:10.351Z'
    }
    if (!item.systemId) {
      item.systemId = '4045f389-f0a7-48e7-bb9e-3822d526d9d4'
    }

    for (const key in item) {
      if (key === 'features' && Array.isArray(item[key])) {
        item[key] = item[key].map((feature) => {
          if (!feature.id) {
            feature.id = uuidv4()
          }

          if (feature.options && Array.isArray(feature.options)) {
            feature.options = feature.options.map((option) => {
              if (option && !option.id) {
                option.id = uuidv4()
              }

              if (option.modifiers && Array.isArray(option.modifiers)) {
                option.modifiers = option.modifiers.map((modifier) => {
                  if (!modifier.id) {
                    modifier.id = uuidv4()
                  }

                  return modifier
                })
              }
              if (option.proficiencies && Array.isArray(option.proficiencies)) {
                option.proficiencies = option.proficiencies.map((proficiency) => {
                  if (!proficiency.id) {
                    proficiency.id = uuidv4()
                  }

                  return proficiency
                })
              }

              if (option.expertise && Array.isArray(option.expertise)) {
                option.expertise = option.expertise.map((expertise) => {
                  if (!expertise.id) {
                    expertise.id = uuidv4()
                  }

                  return expertise
                })
              }

              if (option.spells && Array.isArray(option.spells)) {
                option.spells = option.spells.map((spell) => {
                  if (!spell.id) {
                    spell.id = uuidv4()
                  }
                  return spell
                })
              }

              if (option.senses && Array.isArray(option.senses)) {
                option.senses = option.senses.map((sense) => {
                  if (!sense.id) {
                    sense.id = uuidv4()
                  }
                  return sense
                })
              }

              return option
            })
          }

          if (feature.modifiers && Array.isArray(feature.modifiers)) {
            feature.modifiers = feature.modifiers.map((modifier) => {
              if (!modifier.id) {
                modifier.id = uuidv4()
              }

              return modifier
            })
          }

          if (feature.proficiencies && Array.isArray(feature.proficiencies)) {
            feature.proficiencies = feature.proficiencies.map((proficiency) => {
              if (!proficiency.id) {
                proficiency.id = uuidv4()
              }

              return proficiency
            })
          }

          if (feature.expertise && Array.isArray(feature.expertise)) {
            feature.expertise = feature.expertise.map((expertise) => {
              if (!expertise.id) {
                expertise.id = uuidv4()
              }

              return expertise
            })
          }

          if (feature.prerequisites && Array.isArray(feature.prerequisites)) {
            feature.prerequisites = feature.prerequisites.map((prerequisite) => {
              if (prerequisite.options && Array.isArray(prerequisite.options)) {
                prerequisite.options = prerequisite.options.map((option) => {
                  if (!option.id) {
                    option.id = uuidv4()
                  }
                  return option
                })
              }
              return prerequisite
            })
          }

          if (feature.spells && Array.isArray(feature.spells)) {
            feature.spells = feature.spells.map((spell) => {
              if (!spell.id) {
                spell.id = uuidv4()
              }
              return spell
            })
          }

          if (feature.senses && Array.isArray(feature.senses)) {
            feature.senses = feature.senses.map((sense) => {
              if (!sense.id) {
                sense.id = uuidv4()
              }
              return sense
            })
          }

          return feature
        })
      }
      if (key === 'proficiencies' && Array.isArray(item[key])) {
        item[key] = item[key].map((proficiency) => {
          if (!proficiency.id) {
            proficiency.id = uuidv4()
          }
          return proficiency
        })
      }
      if (key === 'ancestries' && Array.isArray(item[key])) {
        if (item[key].options.length > 0) {
          item[key].options = item[key].options.map((option) => {
            if (!option.id) {
              option.id = uuidv4()
            }

            if (option.modifiers && Array.isArray(option.modifiers)) {
              option.modifiers = option.modifiers.map((modifier) => {
                if (!modifier.id) {
                  modifier.id = uuidv4()
                }

                return modifier
              })
            }
            if (option.proficiencies && Array.isArray(option.proficiencies)) {
              option.proficiencies = option.proficiencies.map((proficiency) => {
                if (!proficiency.id) {
                  proficiency.id = uuidv4()
                }

                return proficiency
              })
            }

            if (option.expertise && Array.isArray(option.expertise)) {
              option.expertise = option.expertise.map((expertise) => {
                if (!expertise.id) {
                  expertise.id = uuidv4()
                }

                return expertise
              })
            }

            if (option.spells && Array.isArray(option.spells)) {
              option.spells = option.spells.map((spell) => {
                if (!spell.id) {
                  spell.id = uuidv4()
                }
                return spell
              })
            }

            if (option.senses && Array.isArray(option.senses)) {
              option.senses = option.senses.map((sense) => {
                if (!sense.id) {
                  sense.id = uuidv4()
                }
                return sense
              })
            }

            return option
          })
        }
      }
      if (key === 'ancestry' && !Array.isArray(item[key])) {
        item[key].id = uuidv4()
      }
    }

    return item
  })

  fs.writeFileSync(filepath, JSON.stringify(fileData, null, 2))
})
