export function getCampaignCapabilities(status: 'ACTIVE' | 'ARCHIVED', role: 'OWNER' | 'PLAYER') {
  const readTableChat = true
  const readPartyChat = role === 'PLAYER'
  if (status === 'ARCHIVED') {
    return {
      edit: false,
      archive: false,
      delete: role === 'OWNER',
      invite: false,
      manageMembers: false,
      manageCharacters: false,
      assignOwnCharacter: false,
      manageSharedContent: false,
      shareOwnedContent: false,
      managePartyInventory: false,
      transferOwnInventory: false,
      manageNotes: false,
      contributeSessionNotes: false,
      readTableChat,
      readPartyChat
    }
  }

  const owner = role === 'OWNER'
  return {
    edit: owner,
    archive: owner,
    delete: owner,
    invite: owner,
    manageMembers: owner,
    manageCharacters: owner,
    assignOwnCharacter: !owner,
    manageSharedContent: owner,
    shareOwnedContent: true,
    managePartyInventory: owner,
    transferOwnInventory: !owner,
    manageNotes: owner,
    contributeSessionNotes: true,
    readTableChat,
    readPartyChat
  }
}
