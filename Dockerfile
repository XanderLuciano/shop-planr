# Production image - uses pre-built .output directory
# Using slim instead of alpine for glibc compatibility with native modules (better-sqlite3)
FROM node:20-slim
WORKDIR /app

COPY .output .output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
