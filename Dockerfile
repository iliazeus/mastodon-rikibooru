FROM node:20.5.0-alpine as build
WORKDIR /app
COPY ./package*.json ./
RUN npm ci --omit optional
COPY ./ ./
RUN ./scripts/build.sh

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=build /app/dist/main.mjs /app/dist/main.mjs.map /app/
CMD ["/app/main.mjs"]
