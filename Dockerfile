FROM node:18-alpine AS build

WORKDIR /build/
COPY tsconfig.json package.json package-lock.json /build/
COPY prisma /build/prisma
RUN npm ci && npm run chgdschema

COPY src /build/src
RUN npm run build

FROM node:18-alpine

EXPOSE 443
WORKDIR /app/
COPY package.json package-lock.json /app/
COPY prisma /app/prisma
RUN npm ci --omit=dev && npm run chgdschema

COPY --from=build /build/dist /app/dist
ENTRYPOINT [ "npm", "start" ]
