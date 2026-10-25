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
      manageActiveCampaign: false,
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
    manageActiveCampaign: owner,
    assignOwnCharacter: true,
    manageSharedContent: owner,
    shareOwnedContent: true,
    managePartyInventory: owner,
    transferOwnInventory: true,
    manageNotes: true,
    contributeSessionNotes: true,
    readTableChat,
    readPartyChat
  }
}
