/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";
import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: {
  adapter: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              data: {
                banExpires?: null | number;
                banReason?: null | string;
                banned?: null | boolean;
                createdAt: number;
                displayUsername?: null | string;
                email: string;
                emailVerified: boolean;
                image?: null | string;
                name: string;
                role?: null | string;
                updatedAt: number;
                userId?: null | string;
                username?: null | string;
              };
              model: "user";
            }
          | {
              data: {
                createdAt: number;
                expiresAt: number;
                impersonatedBy?: null | string;
                ipAddress?: null | string;
                token: string;
                updatedAt: number;
                userAgent?: null | string;
                userId: string;
              };
              model: "session";
            }
          | {
              data: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId: string;
                createdAt: number;
                idToken?: null | string;
                password?: null | string;
                providerId: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt: number;
                userId: string;
              };
              model: "account";
            }
          | {
              data: {
                createdAt: number;
                expiresAt: number;
                identifier: string;
                updatedAt: number;
                value: string;
              };
              model: "verification";
            }
          | {
              data: {
                createdAt: number;
                expiresAt?: null | number;
                privateKey: string;
                publicKey: string;
              };
              model: "jwks";
            }
          | {
              data: { count: number; key: string; lastRequest: number };
              model: "rateLimit";
            };
        onCreateHandle?: string;
        select?: Array<string>;
      },
      any
    >;
    deleteMany: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "role"
                  | "banned"
                  | "banReason"
                  | "banExpires"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "impersonatedBy"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "rateLimit";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "key" | "count" | "lastRequest" | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onDeleteHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any
    >;
    deleteOne: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "role"
                  | "banned"
                  | "banReason"
                  | "banExpires"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "impersonatedBy"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "rateLimit";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "key" | "count" | "lastRequest" | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onDeleteHandle?: string;
      },
      any
    >;
    findMany: FunctionReference<
      "query",
      "public",
      {
        join?: any;
        limit?: number;
        model:
          | "user"
          | "session"
          | "account"
          | "verification"
          | "jwks"
          | "rateLimit";
        offset?: number;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        select?: Array<string>;
        sortBy?: { direction: "asc" | "desc"; field: string };
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          mode?: "sensitive" | "insensitive";
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value:
            string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any
    >;
    findOne: FunctionReference<
      "query",
      "public",
      {
        join?: any;
        model:
          | "user"
          | "session"
          | "account"
          | "verification"
          | "jwks"
          | "rateLimit";
        select?: Array<string>;
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          mode?: "sensitive" | "insensitive";
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value:
            string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any
    >;
    updateMany: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              update: {
                banExpires?: null | number;
                banReason?: null | string;
                banned?: null | boolean;
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                name?: string;
                role?: null | string;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "role"
                  | "banned"
                  | "banReason"
                  | "banExpires"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              update: {
                createdAt?: number;
                expiresAt?: number;
                impersonatedBy?: null | string;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "impersonatedBy"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              update: {
                createdAt?: number;
                expiresAt?: null | number;
                privateKey?: string;
                publicKey?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "rateLimit";
              update: { count?: number; key?: string; lastRequest?: number };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "key" | "count" | "lastRequest" | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onUpdateHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any
    >;
    updateOne: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              update: {
                banExpires?: null | number;
                banReason?: null | string;
                banned?: null | boolean;
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                name?: string;
                role?: null | string;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "role"
                  | "banned"
                  | "banReason"
                  | "banExpires"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              update: {
                createdAt?: number;
                expiresAt?: number;
                impersonatedBy?: null | string;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "impersonatedBy"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              update: {
                createdAt?: number;
                expiresAt?: null | number;
                privateKey?: string;
                publicKey?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "rateLimit";
              update: { count?: number; key?: string; lastRequest?: number };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "key" | "count" | "lastRequest" | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onUpdateHandle?: string;
      },
      any
    >;
  };
  sessionUser: {
    get: FunctionReference<
      "query",
      "public",
      { sessionId: string; userId: string },
      null | {
        _creationTime: number;
        _id: Id<"user">;
        banExpires?: null | number;
        banReason?: null | string;
        banned?: null | boolean;
        createdAt: number;
        displayUsername?: null | string;
        email: string;
        emailVerified: boolean;
        image?: null | string;
        name: string;
        role?: null | string;
        updatedAt: number;
        userId?: null | string;
        username?: null | string;
      }
    >;
  };
} = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: {} = anyApi as any;

export const components = componentsGeneric() as unknown as {};
