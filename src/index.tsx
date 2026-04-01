#!/usr/bin/env node

import { createRequire } from "node:module";
import React from "react";
import { render } from "ink";

import { App } from "./app.js";
import { validateToken } from "./providers/claude.js";
import { interactiveSetup } from "./auth/index.js";

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
    await interactiveSetup(args.includes("--re"));
    return;
  }

  console.log("Validating OAuth token...");
  const result = await validateToken();
  if (!result.ok) {
    console.error(`\n✗ ${result.reason}\n`);
    process.exit(1);
  }
  console.log("✓ Token is valid.\n");

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
