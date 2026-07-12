import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

const projectDirectory = resolve(import.meta.dirname, "..");
const generatorPath = join(projectDirectory, "scripts", "generate-icons.mjs");
const committedOutput = join(projectDirectory, "assets", "icons");
const expectedNames = [
  "app-icon-1024.png",
  "app-icon-192.png",
  "app-icon-512.png",
  "app-icon-maskable-512.png",
  "app-icon-maskable.svg",
  "apple-touch-icon-180.png",
  "notification-badge-96.png",
  "notification-badge.svg",
  ...["hanwha", "lg", "ssg", "doosan", "kia", "samsung", "lotte", "kt", "nc", "kiwoom"].flatMap((slug) => [
    `team-${slug}.svg`,
    `team-${slug}-192.png`,
    `team-${slug}-512.png`,
    `team-${slug}-maskable-512.png`,
    `team-${slug}-apple-touch-180.png`,
  ]),
].sort();

function runGenerator(output) {
  return spawnSync(process.execPath, [generatorPath, "--output", output], {
    cwd: projectDirectory,
    encoding: "utf8",
  });
}

function directorySnapshot(directory) {
  const snapshot = {};
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    const stats = statSync(path);
    snapshot[name] = stats.isDirectory()
      ? { type: "directory", children: directorySnapshot(path) }
      : { type: "file", bytes: readFileSync(path).toString("base64") };
  }
  return snapshot;
}

function assertNoTransactionResidue(output) {
  const prefix = `.${basename(output)}.`;
  const residue = readdirSync(dirname(output)).filter((name) => name.startsWith(prefix));
  assert.deepEqual(residue, [], `transaction residue: ${residue.join(", ")}`);
}

function assertMatchesCommitted(output) {
  assert.deepEqual(readdirSync(output).sort(), expectedNames);
  assert.deepEqual(directorySnapshot(output), directorySnapshot(committedOutput));
}

async function terminateWhileSipsRuns(output) {
  const child = spawn(process.execPath, [generatorPath, "--output", output], {
    cwd: projectDirectory,
    env: {
      ...process.env,
      NODE_ENV: "test",
      TICKET_T_ICON_GENERATOR_HOLD_SIPS: "1",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  await new Promise((resolvePromise, rejectPromise) => {
    const timeout = setTimeout(() => rejectPromise(new Error("generator did not announce sips start")), 3000);
    child.once("message", (message) => {
      clearTimeout(timeout);
      assert.deepEqual(message, { type: "ticket-t-icon-generator", event: "sips-started" });
      resolvePromise();
    });
  });
  assert.equal(child.kill("SIGTERM"), true, "generator exited before SIGTERM probe");
  const result = await new Promise((resolvePromise) => {
    child.once("close", (code, signal) => resolvePromise({ code, signal }));
  });
  return { ...result, stdout, stderr };
}

test("repeated generation into a spaced path is byte-identical", (context) => {
  const fixture = mkdtempSync(join(tmpdir(), "ticket-t-generator-lifecycle-"));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const output = join(fixture, "icons with spaces");

  for (let run = 0; run < 2; run += 1) {
    const result = runGenerator(output);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generated 58 Ticket T icon assets/);
    assertMatchesCommitted(output);
    assertNoTransactionResidue(output);
  }
});

test("unexpected stale entries are rejected before writes", (context) => {
  const fixture = mkdtempSync(join(tmpdir(), "ticket-t-generator-lifecycle-"));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const output = join(fixture, "icons");
  cpSync(committedOutput, output, { recursive: true });
  writeFileSync(join(output, "stale-extra.txt"), "must survive unchanged\n");
  const before = directorySnapshot(output);

  const result = runGenerator(output);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /Generated \d+ Ticket T icon assets/);
  assert.deepEqual(directorySnapshot(output), before);
  assertNoTransactionResidue(output);
});

test("expected-name directory collision leaves output unchanged and no residue", (context) => {
  const fixture = mkdtempSync(join(tmpdir(), "ticket-t-generator-lifecycle-"));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const output = join(fixture, "icons");
  cpSync(committedOutput, output, { recursive: true });
  const collision = join(output, "app-icon-maskable-512.png");
  rmSync(collision);
  mkdirSync(collision);
  const before = directorySnapshot(output);

  const result = runGenerator(output);

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /Generated \d+ Ticket T icon assets/);
  assert.deepEqual(directorySnapshot(output), before);
  assertNoTransactionResidue(output);
});

test("SIGTERM during sips exits nonzero, rolls back, and prints no success", async (context) => {
  const fixture = mkdtempSync(join(tmpdir(), "ticket-t-generator-lifecycle-"));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const output = join(fixture, "icons");
  cpSync(committedOutput, output, { recursive: true });
  const before = directorySnapshot(output);

  const result = await terminateWhileSipsRuns(output);

  assert.equal(result.code, 143, JSON.stringify(result));
  assert.equal(result.signal, null, JSON.stringify(result));
  assert.doesNotMatch(result.stdout, /Generated \d+ Ticket T icon assets/);
  assert.deepEqual(directorySnapshot(output), before);
  assertNoTransactionResidue(output);
});
