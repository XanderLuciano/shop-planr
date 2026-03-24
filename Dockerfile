# Production image - uses pre-built .output directory
# Build locally with: npm run build
# Then build image with: docker build -t shop-erp .
FROM node:20-alpine
WORKDIR /app

COPY .output .output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
