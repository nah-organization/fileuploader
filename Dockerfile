FROM node:18-alpine AS build

WORKDIR /build/
COPY tsconfig.json /build/
COPY package.json /build/
COPY prisma /app/prisma
RUN npm install && npm run chgdschema

COPY src /build/src
RUN npm run build

FROM node:18-alpine

EXPOSE 443
WORKDIR /app/
COPY package.json /app/
RUN npm install --production

COPY .env /app/.env
COPY public /app/public
COPY --from=build /build/dist /app/dist
ENTRYPOINT [ "npm", "start" ]
