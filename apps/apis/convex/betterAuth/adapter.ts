import { createApi } from '@convex-dev/better-auth'
import { createAuthAdapterOptions } from './options'
import schema from './schema'

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, createAuthAdapterOptions)
