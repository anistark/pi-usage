# pi-usage — Multi-Provider AI Usage Monitor

default:
    @just --list

install:
    pnpm install

build:
    pnpm run build

dev:
    pnpm run dev

lint:
    pnpm run lint

format:
    pnpm prettier --write 'src/**/*.{ts,tsx}' 'extensions/**/*.ts'

format-check:
    pnpm prettier --check 'src/**/*.{ts,tsx}' 'extensions/**/*.ts'

test *ARGS:
    pnpm vitest run {{ ARGS }}

test-watch:
    pnpm vitest

qa: format-check lint build test

start:
    node dist/index.js

run *ARGS: build
    node dist/index.js {{ ARGS }}

setup:
    node dist/index.js setup

clean:
    rm -rf dist/

publish: clean build
    pnpm publish
