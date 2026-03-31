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

qa: lint build

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
