FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
ENV YARN_NETWORK_CONCURRENCY=8
ENV YARN_TASK_POOL_CONCURRENCY=2

COPY package.json yarn.lock .yarnrc.yml turbo.json ./
COPY apps/apis/package.json ./apps/apis/package.json
COPY apps/session-host/package.json ./apps/session-host/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/design-system/package.json ./packages/design-system/package.json
COPY packages/emails/package.json ./packages/emails/package.json
COPY packages/functions/package.json ./packages/functions/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN yarn workspaces focus artificer-toolkit @artificer-toolkit/session-host

COPY tsconfig.base.json ./tsconfig.base.json
COPY packages/design-system ./packages/design-system
COPY packages/emails ./packages/emails
COPY packages/schema ./packages/schema
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/functions ./packages/functions
COPY apps/session-host ./apps/session-host

RUN yarn workspace @artificer-toolkit/design-system build
RUN yarn workspace @artificer-toolkit/shared build
RUN yarn workspace @artificer-toolkit/schema build
RUN yarn workspace @artificer-toolkit/emails build
RUN yarn workspace @artificer-toolkit/db build
RUN yarn workspace @artificer-toolkit/functions build
RUN yarn workspace @artificer-toolkit/session-host build
RUN yarn workspaces focus @artificer-toolkit/session-host --production

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=2567
WORKDIR /app/apps/session-host

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/design-system/package.json /app/packages/design-system/package.json
COPY --from=build /app/packages/design-system/dist /app/packages/design-system/dist
COPY --from=build /app/packages/emails/package.json /app/packages/emails/package.json
COPY --from=build /app/packages/emails/dist /app/packages/emails/dist
COPY --from=build /app/packages/schema/package.json /app/packages/schema/package.json
COPY --from=build /app/packages/schema/dist /app/packages/schema/dist
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/packages/db/package.json /app/packages/db/package.json
COPY --from=build /app/packages/db/dist /app/packages/db/dist
COPY --from=build /app/packages/functions/package.json /app/packages/functions/package.json
COPY --from=build /app/packages/functions/dist /app/packages/functions/dist
COPY --from=build /app/apps/session-host/package.json ./package.json
COPY --from=build /app/apps/session-host/dist ./dist

EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
