import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { TEAM_ICON_FAMILIES } from "../scripts/team-icon-config.mjs";

const projectDirectory = resolve(import.meta.dirname, "..");
const iconDirectory = join(projectDirectory, "assets", "icons");
const slugs = ["hanwha", "lg", "ssg", "doosan", "kia", "samsung", "lotte", "kt", "nc", "kiwoom"];
const roles = [
  ["192.png", 192],
  ["512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-180.png", 180],
];
const expectedFamilies = [
  { team: "한화", slug: "hanwha", anchor: "H", motif: "side-block", base: "#ff6a16", edge: "#c23e00", ink: "#ffffff" },
  { team: "LG", slug: "lg", anchor: "L", motif: "edge-arc", base: "#c4194e", edge: "#8a0033", ink: "#ffffff" },
  { team: "SSG", slug: "ssg", anchor: "S", motif: "triple-stamp", base: "#d10d2b", edge: "#960019", ink: "#ffffff" },
  { team: "두산", slug: "doosan", anchor: "D", motif: "diagonal-panel", base: "#1a2a6c", edge: "#0c1640", ink: "#ffffff" },
  { team: "KIA", slug: "kia", anchor: "K", motif: "ink-sash", base: "#e3002b", edge: "#9c001d", ink: "#ffffff" },
  { team: "삼성", slug: "samsung", anchor: "S", motif: "bottom-block", base: "#1063b0", edge: "#063a6b", ink: "#ffffff" },
  { team: "롯데", slug: "lotte", anchor: "L", motif: "split-field", base: "#0a2a55", edge: "#c8102e", ink: "#ffffff" },
  { team: "KT", slug: "kt", anchor: "K", motif: "corner-cuts", base: "#2c2c30", edge: "#000000", ink: "#ffffff" },
  { team: "NC", slug: "nc", anchor: "N", motif: "foil-frame", base: "#1d467f", edge: "#0f2c54", ink: "#f0d08a" },
  { team: "키움", slug: "kiwoom", anchor: "K", motif: "offset-cards", base: "#641a2e", edge: "#3c0a18", ink: "#ffffff" },
];

function pngDimensions(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${path} is not PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("all ten stable team families provide every install icon role", () => {
  const missing = [];
  for (const slug of slugs) {
    if (!existsSync(join(iconDirectory, `team-${slug}.svg`))) missing.push(`team-${slug}.svg`);
    for (const [suffix] of roles) {
      const name = `team-${slug}-${suffix}`;
      if (!existsSync(join(iconDirectory, name))) missing.push(name);
    }
  }
  assert.deepEqual(missing, [], `missing team icon assets: ${missing.join(", ")}`);
});

test("team config preserves app colors and bold single-letter anchors", () => {
  assert.deepEqual(TEAM_ICON_FAMILIES, expectedFamilies);
  assert.equal(new Set(TEAM_ICON_FAMILIES.map(({ slug }) => slug)).size, 10);
  assert.equal(new Set(TEAM_ICON_FAMILIES.map(({ motif }) => motif)).size, 10);
  for (const family of TEAM_ICON_FAMILIES) {
    assert.match(family.anchor, /^[A-Z]$/);
    assert.equal("code" in family, false);
  }
});

test("team SVGs remain original flat ticket art without prohibited cues", () => {
  const hashes = new Set();
  for (const family of TEAM_ICON_FAMILIES) {
    const path = join(iconDirectory, `team-${family.slug}.svg`);
    const svg = readFileSync(path, "utf8");
    assert.match(svg, /viewBox="0 0 1024 1024"/);
    assert.match(svg, new RegExp(`fill="${family.base}"`));
    assert.match(svg, new RegExp(`fill="${family.edge}"`));
    assert.match(svg, new RegExp(`(?:fill|stroke)="${family.ink}"`));
    assert.match(svg, new RegExp(`data-anchor="${family.anchor}"`));
    assert.match(svg, /data-letterpress="bold"/);
    assert.doesNotMatch(svg, /<(?:text|image|linearGradient|radialGradient)\b/i);
    assert.doesNotMatch(svg, /stroke-width="(?:[1-7]?\d(?:\.\d+)?)"|data-pixel-grid|utility-tick/i);
    assert.doesNotMatch(svg, /mascot|emoji|baseball|stitch|official|logo|crest/i);
    hashes.add(sha256(path));
  }
  assert.equal(hashes.size, 10, "every team master must be visually distinct");
});

test("team icon source has no thin pixel alphabet generator", () => {
  const source = readFileSync(join(projectDirectory, "scripts", "team-icon-config.mjs"), "utf8");
  assert.doesNotMatch(source, /GLYPHS|wordPath|cellX|cellY|family\.code/);
});

test("all forty team PNGs have exact role dimensions and distinct family bytes", () => {
  const roleHashes = new Map(roles.map(([suffix]) => [suffix, new Set()]));
  for (const slug of slugs) {
    for (const [suffix, size] of roles) {
      const path = join(iconDirectory, `team-${slug}-${suffix}`);
      assert.deepEqual(pngDimensions(path), { width: size, height: size });
      roleHashes.get(suffix).add(sha256(path));
    }
  }
  for (const [suffix, hashes] of roleHashes) {
    assert.equal(hashes.size, 10, `${suffix} must contain ten distinct team renders`);
  }
});
