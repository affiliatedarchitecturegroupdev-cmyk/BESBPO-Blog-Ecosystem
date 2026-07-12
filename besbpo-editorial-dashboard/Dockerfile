# besbpo-editorial-dashboard — Coolify-deployed, Doc-01 Section 5.
# Deliberately a real running Next.js server (next start), NOT a static
# export — see next.config.js for why.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/next.config.js ./next.config.js
EXPOSE 3001
ENV PORT=3001
CMD ["npm", "start"]
