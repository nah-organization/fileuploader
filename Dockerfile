FROM node:18-alpine AS build

WORKDIR /build/
COPY tsconfig.json /build/
COPY package.json /build/
COPY prisma /build/prisma
RUN npm install && npm run chgdschema

COPY src /build/src
RUN npm run build

FROM node:18-alpine

EXPOSE 443
WORKDIR /app/
COPY package.json /app/
COPY prisma /app/prisma
RUN npm install --omit=dev && npm run chgdschema

COPY --from=build /build/dist /app/dist
ENTRYPOINT [ "npm", "start" ]
