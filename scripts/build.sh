#!/bin/sh

npx esbuild \
  --bundle --sourcemap --charset=utf8 \
  --platform=node --format=esm \
  --external:dotenv \
  ./src/main.ts \
  --outfile=./dist/main.mjs
