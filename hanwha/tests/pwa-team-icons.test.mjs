import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const projectDirectory = resolve(import.meta.dirname, "..");
const families = [
  { team: "all", slug: null },
  { team: "한화", slug: "hanwha" },
  { team: "LG", slug: "lg" },
  { team: "SSG", slug: "ssg" },
  { team: "두산", slug: "doosan" },
  { team: "KIA", slug: "kia" },
  { team: "삼성", slug: "samsung" },
  { team: "롯데", slug: "lotte" },
  { team: "KT", slug: "kt" },
  { team: "NC", slug: "nc" },
  { team: "키움", slug: "kiwoom" },
];

function familyPaths(slug) {
  if (slug === null) {
    return {
      manifest: "./manifest.webmanifest",
      apple: "./assets/icons/apple-touch-icon-180.png",
      icons: [
        ["./assets/icons/app-icon-192.png", "192x192", "any"],
        ["./assets/icons/app-icon-512.png", "512x512", "any"],
        ["./assets/icons/app-icon-maskable-512.png", "512x512", "maskable"],
      ],
    };
  }
  return {
    manifest: `./manifest-${slug}.webmanifest`,
    apple: `./assets/icons/team-${slug}-apple-touch-180.png`,
    icons: [
      [`./assets/icons/team-${slug}-192.png`, "192x192", "any"],
      [`./assets/icons/team-${slug}-512.png`, "512x512", "any"],
      [`./assets/icons/team-${slug}-maskable-512.png`, "512x512", "maskable"],
    ],
  };
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${path} must be PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test("neutral and ten teams map to stable manifest and Apple PNG families", () => {
  const [index, script] = ["index.html", "script.js"].map((name) =>
    readFileSync(join(projectDirectory, name), "utf8"),
  );

  assert.match(index, /<link\s+id="manifestLink"\s+rel="manifest"\s+href="\.\/manifest\.webmanifest"/);
  assert.match(index, /<link\s+id="appleTouchIcon"\s+rel="apple-touch-icon"\s+href="\.\/assets\/icons\/apple-touch-icon-180\.png"/);

  for (const { team, slug } of families) {
    const { manifest, apple } = familyPaths(slug);
    assert.ok(script.includes(`"${team}":`), `missing selectedTeam mapping for ${team}`);
    assert.ok(script.includes(`manifest: "${manifest}"`), `wrong manifest mapping for ${team}`);
    assert.ok(script.includes(`apple: "${apple}"`), `wrong Apple icon mapping for ${team}`);
  }

  assert.match(script, /function syncInstallIconLinks/);
  assert.match(script, /selectedTeam = readSelectedTeam\(\);[\s\S]{0,1200}syncInstallIconLinks\(\);/);
  assert.match(script, /function setSelectedTeam[\s\S]*?selectedTeam = team;[\s\S]*?syncInstallIconLinks\(\);/);
  assert.match(script, /Object\.hasOwn\(INSTALL_ICON_FAMILIES, team\)/);
});

test("all eleven manifests are valid JSON with exact role-specific PNG declarations", () => {
  for (const { slug } of families) {
    const expected = familyPaths(slug);
    const manifestPath = join(projectDirectory, expected.manifest.slice(2));
    assert.ok(existsSync(manifestPath), `${expected.manifest} must exist`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.deepEqual(
      manifest.icons.map(({ src, sizes, type, purpose }) => [src, sizes, type, purpose]),
      expected.icons.map(([src, sizes, purpose]) => [src, sizes, "image/png", purpose]),
    );
    for (const [src, sizes] of expected.icons) {
      const iconPath = join(projectDirectory, src.slice(2));
      assert.ok(existsSync(iconPath), `${src} must exist`);
      assert.equal(pngDimensions(iconPath), sizes);
    }
    assert.doesNotMatch(JSON.stringify(manifest.icons), /\.svg|any maskable/);
  }
});

test("favicon stays SVG while Apple and every notification role use neutral PNG assets", () => {
  const [index, script, serviceWorker] = ["index.html", "script.js", "service-worker.js"].map((name) =>
    readFileSync(join(projectDirectory, name), "utf8"),
  );
  assert.match(index, /rel="icon"\s+href="\.\/assets\/app-icon\.svg"\s+type="image\/svg\+xml"/);
  assert.doesNotMatch(index.match(/<link[^>]+rel="apple-touch-icon"[^>]*>/)?.[0] ?? "", /\.svg/);

  const scriptRoles = [...script.matchAll(/\b(icon|badge):\s*"([^"]+)"/g)].map((match) => match.slice(1));
  const workerRoles = [...serviceWorker.matchAll(/\b(icon|badge):\s*"([^"]+)"/g)].map((match) => match.slice(1));
  assert.equal(scriptRoles.filter(([role]) => role === "icon").length, 4);
  assert.equal(scriptRoles.filter(([role]) => role === "badge").length, 4);
  assert.equal(workerRoles.filter(([role]) => role === "icon").length, 1);
  assert.equal(workerRoles.filter(([role]) => role === "badge").length, 1);
  for (const [role, path] of [...scriptRoles, ...workerRoles]) {
    assert.equal(path, role === "icon" ? "./assets/icons/app-icon-192.png" : "./assets/icons/notification-badge-96.png");
    assert.ok(existsSync(join(projectDirectory, path.slice(2))));
  }
});

test("service worker precaches every runtime manifest and icon under a relative subpath", () => {
  const serviceWorker = readFileSync(join(projectDirectory, "service-worker.js"), "utf8");
  const appShell = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? "";
  const precached = new Set([...appShell.matchAll(/"(\.\/[^\"]+)"/g)].map((match) => match[1]));
  const required = new Set([
    "./assets/app-icon.svg",
    "./assets/icons/app-icon-192.png",
    "./assets/icons/notification-badge-96.png",
  ]);
  for (const { slug } of families) {
    const { manifest, apple, icons } = familyPaths(slug);
    required.add(manifest);
    required.add(apple);
    icons.forEach(([src]) => required.add(src));
  }
  assert.deepEqual([...required].filter((path) => !precached.has(path)), []);
  assert.ok([...required].every((path) => path.startsWith("./")));
});

test("install guidance states that a team icon change requires remove and re-add", () => {
  const [index, styles] = ["index.html", "styles.css"].map((name) =>
    readFileSync(join(projectDirectory, name), "utf8"),
  );
  assert.match(index, /마이팀 아이콘을 바꾸려면 앱을 삭제한 뒤 다시&nbsp;설치하세요\./);
  assert.match(index, /설치&nbsp;후 자동 변경은 지원되지&nbsp;않습니다\./);
  assert.doesNotMatch(index, /마이팀 변경 후 설치 아이콘|다시 추가해 주세요|OS는 설치 후/);
  assert.match(
    styles,
    /\.ios-install-sheet__lead\s*\{[\s\S]*?word-break:\s*keep-all;[\s\S]*?overflow-wrap:\s*break-word;/,
  );
});

test("manifest wiring references only the verified self-owned icon allowlist", () => {
  const expectedAssets = new Set();
  for (const { slug } of families) {
    const { apple, icons } = familyPaths(slug);
    expectedAssets.add(apple);
    icons.forEach(([src]) => expectedAssets.add(src));
  }
  assert.equal(expectedAssets.size, 44);
  for (const path of expectedAssets) {
    assert.doesNotMatch(path, /official|logo|crest|mascot|kbo[-_]?logo/i);
    assert.ok(existsSync(join(projectDirectory, path.slice(2))));
  }
});
