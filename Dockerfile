# Multi-stage production build for GORO S2JB Command Center
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 py3-pip py3-pillow tesseract-ocr tesseract-ocr-data-ind

# Stage 1: Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create uploads and logs directories
RUN mkdir -p /app/uploads/evidence /app/logs && chown -R nextjs:nodejs /app/uploads /app/logs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/python-services ./python-services

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
