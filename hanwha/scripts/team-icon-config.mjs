const PAPER = "#fbf7ee";

const ANCHOR_PATHS = Object.freeze({
  H: "M316 318h96v150h200V318h96v388h-96V558H412v148h-96Z",
  L: "M350 318h104v282h240v106H350Z",
  S: "M652 374H482c-92 0-142 38-142 96s50 96 142 96h70c92 0 142 38 142 96s-50 96-142 96H352",
  D: "M320 318h224c124 0 196 74 196 194s-72 194-196 194H320ZM424 414v196h120c62 0 96-36 96-98s-34-98-96-98Z",
  K: "M316 318h104v388H316ZM410 502l190-184h132L506 536ZM486 516l246 190H588L410 572Z",
  N: "M316 318h104v388H316ZM604 318h104v388H604ZM394 318h110l126 388H520Z",
});

export const TEAM_ICON_FAMILIES = Object.freeze([
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
].map((family) => Object.freeze(family)));

function motifMarkup(family) {
  switch (family.motif) {
    case "side-block":
      return `<g data-motif="side-block"><path fill="${family.edge}" d="M202 202h160v620H202z"/><path fill="${PAPER}" d="M258 258h104v508H258z"/></g>`;
    case "edge-arc":
      return `<g data-motif="edge-arc"><path fill="none" stroke="${family.edge}" stroke-width="96" stroke-linecap="butt" d="M604 258a190 190 0 0 1 190 190"/></g>`;
    case "triple-stamp":
      return `<g data-motif="triple-stamp"><circle fill="${family.edge}" cx="320" cy="292" r="72"/><circle fill="${family.edge}" cx="512" cy="292" r="72"/><circle fill="${family.edge}" cx="704" cy="292" r="72"/></g>`;
    case "diagonal-panel":
      return `<g data-motif="diagonal-panel"><path fill="${family.edge}" d="M202 202h230l390 620H592L202 432Z"/></g>`;
    case "ink-sash":
      return `<g data-motif="ink-sash"><path fill="${family.edge}" d="M202 642v180h154l466-430V202H678Z"/></g>`;
    case "bottom-block":
      return `<g data-motif="bottom-block"><path fill="${family.edge}" d="M202 630h620v192H202z"/><path fill="${PAPER}" d="M612 678h154v96H612z"/></g>`;
    case "split-field":
      return `<g data-motif="split-field"><path fill="${family.edge}" d="M510 202h312v620H510z"/><path fill="${PAPER}" d="M640 246h138v154H640z"/><path fill="${family.base}" d="M676 282h102v118H676z"/></g>`;
    case "corner-cuts":
      return `<g data-motif="corner-cuts"><path fill="${family.edge}" d="M202 202h238v174H202zM584 648h238v174H584z"/></g>`;
    case "foil-frame":
      return `<g data-motif="foil-frame"><path fill="${family.ink}" d="M202 202h620v104H202zM202 718h620v104H202z"/></g>`;
    case "offset-cards":
      return `<g data-motif="offset-cards"><path fill="${family.edge}" d="M202 202h254v192H202zM568 630h254v192H568z"/><path fill="${PAPER}" d="M252 252h204v142H252zM568 630h204v142H568z"/><path fill="${family.base}" d="M294 294h162v100H294zM568 630h162v100H568z"/></g>`;
    default:
      throw new Error(`unknown team icon motif: ${family.motif}`);
  }
}

function anchorMarkup(family) {
  const path = ANCHOR_PATHS[family.anchor];
  if (!path) throw new Error(`unsupported team icon anchor: ${family.anchor}`);
  if (family.anchor === "S") {
    return `<g data-letterpress="bold" data-anchor="S"><path fill="none" stroke="${family.edge}" stroke-width="124" stroke-linecap="round" stroke-linejoin="round" transform="translate(18 20)" d="${path}"/><path fill="none" stroke="${family.ink}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round" d="${path}"/></g>`;
  }
  return `<g data-letterpress="bold" data-anchor="${family.anchor}"><path fill="${family.edge}" fill-rule="evenodd" transform="translate(18 20)" d="${path}"/><path fill="${family.ink}" fill-rule="evenodd" d="${path}"/></g>`;
}

export function createTeamIconSvg(family) {
  if (!TEAM_ICON_FAMILIES.includes(family)) throw new Error("unknown team icon family");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="${family.team} 오리지널 티켓 설치 아이콘">
  <title>${family.team} collectible ticket icon</title>
  <rect width="1024" height="1024" fill="${family.edge}"/>
  <path fill="${PAPER}" d="M148 148h728v242c-70 0-70 244 0 244v242H148V634c70 0 70-244 0-244Z"/>
  <path fill="${family.base}" d="M202 202h620v188c-62 0-62 244 0 244v188H202V634c62 0 62-244 0-244Z"/>
  ${motifMarkup(family)}
  ${anchorMarkup(family)}
</svg>
`;
}
