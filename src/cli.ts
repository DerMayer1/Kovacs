#!/usr/bin/env node
import { runCli } from "./v01/cli.js";

runCli().then(
  (code) => { process.exitCode = code; },
  (error: unknown) => {
    console.error(`Kovacs error: ${(error as Error).message}`);
    process.exitCode = 1;
  },
);
