#!/usr/bin/env node

import { createRequire } from "node:module";
import React from "react";
import { render } from "ink";

import { App } from "./app.js";
import { isAuthenticated } from "./auth/index.js";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json");

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version")) {
    console.log(`pi-usage ${VERSION}`);
    return;
  }

  if (args[0] === "setup") {
    const { interactiveSetup } = await import("./auth/index.js");
    await interactiveSetup(args.includes("--re"));
    return;
  }

  if (!isAuthenticated()) {
    console.error("\n✗ No credentials found.\n");
    console.error("If you have Claude Code or pi installed, credentials are picked up automatically.");
    console.error("Otherwise, run: pi-usage setup\n");
    process.exit(1);
  }

  process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H");
  const instance = render(<App version={VERSION} />);
  instance.waitUntilExit().then(() => {
    process.stdout.write("\x1b[?1049l");
  });
}

function printHelp(): void {
  console.log(`pi-usage — Multi-Provider AI Usage Monitor

Usage:
  pi-usage              Launch the TUI dashboard
  pi-usage setup        Interactive OAuth setup (Claude)
  pi-usage setup --re   Force re-authentication

Options:
  --help, -h       Show this help
  --version        Show version

Keybindings (in TUI):
  q    Quit
  r    Force refresh
  ?    Show help
  Tab  Switch provider`);
}

main();
