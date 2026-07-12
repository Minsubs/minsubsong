import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTeamIconSvg, TEAM_ICON_FAMILIES } from "./team-icon-config.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const sourceDirectory = join(projectDirectory, "assets");

const masters = [
  { source: join(sourceDirectory, "app-icon.svg"), output: null, viewBox: "0 0 1024 1024" },
  { source: join(sourceDirectory, "icons", "app-icon-maskable.svg"), output: "app-icon-maskable.svg", viewBox: "0 0 1024 1024" },
  { source: join(sourceDirectory, "icons", "notification-badge.svg"), output: "notification-badge.svg", viewBox: "0 0 96 96" },
];

const conversions = [
  { source: masters[0].source, output: "app-icon-1024.png", size: 1024 },
  { source: masters[0].source, output: "app-icon-512.png", size: 512 },
  { source: masters[0].source, output: "app-icon-192.png", size: 192 },
  { source: masters[0].source, output: "apple-touch-icon-180.png", size: 180 },
  { source: masters[1].source, output: "app-icon-maskable-512.png", size: 512 },
  { source: masters[2].source, output: "notification-badge-96.png", size: 96 },
];

const teamMasters = TEAM_ICON_FAMILIES.map((family) => ({
  content: createTeamIconSvg(family),
  output: `team-${family.slug}.svg`,
}));

const teamConversions = TEAM_ICON_FAMILIES.flatMap((family) => [
  { master: `team-${family.slug}.svg`, output: `team-${family.slug}-192.png`, size: 192 },
  { master: `team-${family.slug}.svg`, output: `team-${family.slug}-512.png`, size: 512 },
  { master: `team-${family.slug}.svg`, output: `team-${family.slug}-maskable-512.png`, size: 512 },
  { master: `team-${family.slug}.svg`, output: `team-${family.slug}-apple-touch-180.png`, size: 180 },
]);

const expectedNames = [
  ...masters.flatMap((master) => (master.output ? [master.output] : [])),
  ...conversions.map((conversion) => conversion.output),
  ...teamMasters.map((master) => master.output),
  ...teamConversions.map((conversion) => conversion.output),
].sort();

class InterruptedError extends Error {
  constructor(signal) {
    super(`interrupted by ${signal}`);
    this.name = "InterruptedError";
    this.signal = signal;
  }
}

let activeChild = null;
let receivedSignal = null;
let releaseSignalTestHold = null;

function parseOutput(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--output") {
    throw new Error("usage: node scripts/generate-icons.mjs --output <directory>");
  }

  const value = argumentsList[1];
  if (!value || value.startsWith("-")) {
    throw new Error("--output must be a directory path, not an option");
  }

  return isAbsolute(value) ? resolve(value) : resolve(process.cwd(), value);
}

function throwIfInterrupted() {
  if (receivedSignal) throw new InterruptedError(receivedSignal);
}

function handleSignal(signal) {
  receivedSignal ??= signal;
  releaseSignalTestHold?.();
  if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
    activeChild.kill(signal);
  }
}

async function runSips(argumentsList, purpose) {
  throwIfInterrupted();
  const completion = new Promise((resolvePromise) => {
    const child = spawn("/usr/bin/sips", argumentsList, { stdio: ["ignore", "pipe", "pipe"] });
    activeChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      activeChild = null;
      resolvePromise({ error });
    });
    child.once("close", (status, signal) => {
      activeChild = null;
      resolvePromise({ status, signal, stdout, stderr });
    });
  });

  if (
    process.env.NODE_ENV === "test"
    && process.env.TICKET_T_ICON_GENERATOR_HOLD_SIPS === "1"
    && typeof process.send === "function"
  ) {
    await new Promise((resolvePromise) => {
      releaseSignalTestHold = resolvePromise;
      process.send({ type: "ticket-t-icon-generator", event: "sips-started" });
    });
    releaseSignalTestHold = null;
  }

  const result = await completion;
  throwIfInterrupted();
  if (result.error) throw new Error(`${purpose}: ${result.error.message}`);
  if (result.signal || result.status === null || result.status !== 0) {
    const output = `${result.stdout}\n${result.stderr}`.trim();
    const outcome = result.signal ? `signal ${result.signal}` : `exit ${String(result.status)}`;
    throw new Error(`${purpose}: sips ended with ${outcome}${output ? `: ${output}` : ""}`);
  }
  return result.stdout;
}

function assertMaster(master) {
  const source = readFileSync(master.source, "utf8");
  const viewBoxPattern = new RegExp(`viewBox=["']${master.viewBox.replaceAll(" ", "\\s+")}["']`);
  if (!viewBoxPattern.test(source)) {
    throw new Error(`${relative(projectDirectory, master.source)} must declare viewBox ${master.viewBox}`);
  }
  if (/<(?:linear|radial)Gradient\b/i.test(source)) {
    throw new Error(`${relative(projectDirectory, master.source)} must not contain gradients`);
  }
  return source;
}

async function pngDimensions(path) {
  const output = await runSips(["-g", "pixelWidth", "-g", "pixelHeight", path], `inspect ${path}`);
  const width = Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return { width, height };
}

function preflightOutput(outputDirectory) {
  if (!existsSync(outputDirectory)) return false;
  if (!lstatSync(outputDirectory).isDirectory()) {
    throw new Error(`output path exists and is not a directory: ${outputDirectory}`);
  }

  const entries = readdirSync(outputDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  const actualNames = entries.map((entry) => entry.name);
  const missing = expectedNames.filter((name) => !actualNames.includes(name));
  const unexpected = actualNames.filter((name) => !expectedNames.includes(name));
  if (missing.length || unexpected.length) {
    throw new Error(
      `existing output must contain exactly the generator-owned files; missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`,
    );
  }

  const collisions = entries.filter((entry) => !entry.isFile()).map((entry) => entry.name);
  if (collisions.length) {
    throw new Error(`existing output contains non-file destination collisions: ${collisions.join(", ")}`);
  }
  return true;
}

function cleanupDirectory(path) {
  if (path && existsSync(path)) rmSync(path, { recursive: true, force: true });
}

async function generateIcons(outputDirectory) {
  const hadOriginalOutput = preflightOutput(outputDirectory);
  const parentDirectory = dirname(outputDirectory);
  mkdirSync(parentDirectory, { recursive: true });

  let stagingDirectory = mkdtempSync(join(parentDirectory, `.${basename(outputDirectory)}.staging-`));
  let backupDirectory = null;
  let originalMoved = false;
  let replacementInstalled = false;
  let committed = false;

  try {
    const masterContents = new Map(masters.map((master) => [master.source, assertMaster(master)]));
    for (const master of masters) {
      if (master.output) writeFileSync(join(stagingDirectory, master.output), masterContents.get(master.source), "utf8");
    }
    for (const master of teamMasters) {
      writeFileSync(join(stagingDirectory, master.output), master.content, "utf8");
    }

    const allConversions = [
      ...conversions,
      ...teamConversions.map((conversion) => ({
        ...conversion,
        source: join(stagingDirectory, conversion.master),
      })),
    ];
    for (const conversion of allConversions) {
      const destination = join(stagingDirectory, conversion.output);
      await runSips(
        ["-s", "format", "png", "--resampleHeightWidth", String(conversion.size), String(conversion.size), conversion.source, "--out", destination],
        `render ${conversion.output}`,
      );
      const dimensions = await pngDimensions(destination);
      if (dimensions.width !== conversion.size || dimensions.height !== conversion.size) {
        throw new Error(`${conversion.output} is ${dimensions.width}x${dimensions.height}; expected ${conversion.size}x${conversion.size}`);
      }
    }

    const actualNames = readdirSync(stagingDirectory).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
      throw new Error(`generated names differ: ${actualNames.join(", ")}`);
    }
    throwIfInterrupted();

    if (hadOriginalOutput) {
      backupDirectory = join(parentDirectory, `.${basename(outputDirectory)}.backup-${randomUUID()}`);
      renameSync(outputDirectory, backupDirectory);
      originalMoved = true;
    }
    renameSync(stagingDirectory, outputDirectory);
    stagingDirectory = null;
    replacementInstalled = true;

    await new Promise((resolvePromise) => setImmediate(resolvePromise));
    throwIfInterrupted();
    cleanupDirectory(backupDirectory);
    backupDirectory = null;
    committed = true;
  } finally {
    if (!committed) {
      if (replacementInstalled) cleanupDirectory(outputDirectory);
      if (originalMoved && backupDirectory && existsSync(backupDirectory)) {
        renameSync(backupDirectory, outputDirectory);
        backupDirectory = null;
      }
    }
    cleanupDirectory(stagingDirectory);
    cleanupDirectory(backupDirectory);
  }
}

const signalHandlers = new Map();
for (const signal of ["SIGINT", "SIGTERM"]) {
  const handler = () => handleSignal(signal);
  signalHandlers.set(signal, handler);
  process.once(signal, handler);
}

try {
  const outputDirectory = parseOutput(process.argv.slice(2));
  await generateIcons(outputDirectory);
  throwIfInterrupted();
  console.log(`Generated ${expectedNames.length} Ticket T icon assets in ${outputDirectory}`);
  for (const name of expectedNames) console.log(`- ${name}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`generate-icons: ${message}`);
  process.exitCode = error instanceof InterruptedError
    ? (error.signal === "SIGINT" ? 130 : 143)
    : 1;
} finally {
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
}
