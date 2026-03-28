# Production image - uses pre-built .output directory
# Using node:24-slim to match build environment (glibc + same Node version)
FROM node:24-slim
WORKDIR /app

COPY .output .output
COPY server/repositories/sqlite/migrations server/repositories/sqlite/migrations

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
