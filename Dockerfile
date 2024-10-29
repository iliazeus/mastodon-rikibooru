FROM node:22-bookworm as build
WORKDIR /app
COPY ./package*.json ./
RUN npm ci --omit optional
COPY ./ ./
RUN ./scripts/build.sh

FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=build /app/dist/main.mjs /app/dist/main.mjs.map /app/
CMD ["/app/main.mjs"]
