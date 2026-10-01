import { v } from 'convex/values'
import { internalMutation } from './lib/mutations'
import { onAuthUserCreate, onAuthUserDelete, onAuthUserUpdate } from './lib/authTriggers.helper'
import { tables } from './betterAuth/schema'

function authUser(args: { model: string; doc: unknown }): { _id: string } | null {
  if (args.model !== 'user') return null
  if (
    typeof args.doc !== 'object' ||
    args.doc === null ||
    !('_id' in args.doc) ||
    typeof args.doc._id !== 'string'
  ) {
    throw new Error('Invalid Better Auth user trigger.')
  }
  return { _id: args.doc._id }
}

export const onCreate = internalMutation({
  args: { doc: v.any(), model: v.string() },
  handler: async (ctx, args) => {
    const user = authUser(args)
    if (user) await onAuthUserCreate(ctx, user)
  }
})

export const onDelete = internalMutation({
  args: { doc: v.any(), model: v.string() },
  handler: async (ctx, args) => {
    const user = authUser(args)
    if (user) await onAuthUserDelete(ctx, user)
  }
})

const storedAuthUser = v.object({
  ...tables.user.validator.fields,
  _id: v.string(),
  _creationTime: v.number()
})

export const onUpdate = internalMutation({
  args: { newDoc: storedAuthUser, oldDoc: storedAuthUser, model: v.literal('user') },
  handler: async (ctx, { newDoc, oldDoc }) => {
    if (newDoc._id !== oldDoc._id) throw new Error('Better Auth user identity changed.')
    if (
      (newDoc.displayUsername ?? newDoc.username ?? null) ===
      (oldDoc.displayUsername ?? oldDoc.username ?? null)
    )
      return
    await onAuthUserUpdate(ctx, newDoc)
  }
})
