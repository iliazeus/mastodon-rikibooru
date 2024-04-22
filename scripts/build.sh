#!/bin/sh

npx esbuild \
  --bundle --sourcemap --minify --charset=utf8 \
  --platform=node --format=esm \
  ./src/main.ts \
  --outfile=./dist/main.mjs
