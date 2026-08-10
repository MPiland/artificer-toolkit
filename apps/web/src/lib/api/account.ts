import {
  accountProfileDtoSchema,
  accountUsernameStatusDtoSchema,
  type AccountProfileUpdateInput,
  type AccountUsernameStatusInput
} from '@artificer-toolkit/schema/api/account'
import {
  authSessionCredentialsDtoSchema,
  type AuthInvitationCompletionInput,
  type AuthUsernameSignInInput
} from '@artificer-toolkit/schema/api/auth'
import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { okResponseSchema, request, type TrpcClient } from './transport'

export function buildAccountApi(client: TrpcClient) {
  return {
    completeInvitation: (input: AuthInvitationCompletionInput) =>
      request('account.completeInvitation', okResponseSchema, () =>
        client.account.completeInvitation.mutate(input)
      ),
    entitlements: () =>
      request('account.entitlements', campaignContracts.entitlementProjectionDtoSchema, () =>
        client.account.entitlements.query()
      ),
    profile: () =>
      request('account.profile', accountProfileDtoSchema.nullable(), () =>
        client.account.profile.query()
      ),
    signInWithUsername: (input: AuthUsernameSignInInput) =>
      request('account.signInWithUsername', authSessionCredentialsDtoSchema, () =>
        client.account.signInWithUsername.mutate(input)
      ),
    updateProfile: (input: AccountProfileUpdateInput) =>
      request('account.updateProfile', accountProfileDtoSchema, () =>
        client.account.updateProfile.mutate(input)
      ),
    usernameStatus: (input: AccountUsernameStatusInput) =>
      request('account.usernameStatus', accountUsernameStatusDtoSchema, () =>
        client.account.usernameStatus.query(input)
      )
  }
}

export type AccountApi = ReturnType<typeof buildAccountApi>
