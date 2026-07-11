// worker/lib/scoreboard.js
//
// KBO 스코어보드(HTML) 파서 — 워커 lib 순수 함수 포팅.
//
// 출처: ../scripts/update-data.mjs 의 parseScoreboard/parseScoreboardRows 및
// 의존 헬퍼(extractRows, cleanText, decodeEntities, buildLineScoreFromRows,
// normalizeInningScore, emptyLineScore, locationToKorean)를 그대로 옮긴다.
// 앱 파이프라인(scripts/update-data.mjs)에서 이미 검증된 정규식/로직이므로
// 원본은 절대 수정하지 않고, 워커에서 재사용 가능하도록 순수 함수로만 복제한다.
//
// 출력 shape(원본과 동일, LIVE_ALERTS_DESIGN_2026-07.md §2 LV1a):
//   [{ away, home, awayScore, homeScore, state, location, rawTime, linescore }]
//   - awayScore/homeScore: 경기 전에는 null(0 오표기 방지).
//   - linescore: 9이닝 배열 [{ inning, away, home }] — 매칭 실패 시 전부 null.
//
// 네트워크/타이머 등 I/O 는 이 파일에 없다 — index.js 가 fetch 결과 HTML 문자열을
// 넘겨주고, 이 파일은 그 문자열만 순수 변환한다(node --test 로 단위검증 가능).

/**
 * KBO 스코어보드 HTML 전체를 경기 배열로 파싱한다.
 * @param {string} html - Scoreboard.aspx 응답 HTML
 * @returns {Array<{away:string,home:string,awayScore:number|null,homeScore:number|null,state:string,location:string,rawTime:string,linescore:Array<{inning:string,away:number|null,home:number|null}>}>}
 */
export function parseScoreboard(html) {
  return String(html ?? "")
    .split(/<div class="scoreboard_time">/i)
    .slice(1)
    .map((segment) => {
      const header = segment.split(/<div class="tbl_common tbl_scoreboard">/i)[0] ?? "";
      const table =
        segment.match(/<div class="tbl_common tbl_scoreboard">([\s\S]*?)<\/div>\s*<!--\/\/tbl_common -->/i)?.[1] ?? "";
      const teams = [...header.matchAll(/<span class="team_name">([\s\S]*?)<\/span>/gi)].map((match) =>
        cleanText(match[1]),
      );
      const scores = [...header.matchAll(/<span class="team_score"><span[^>]*>([\s\S]*?)<\/span><\/span>/gi)].map(
        (match) => {
          // 경기 전에는 점수 칸이 비어 있다. Number("") === 0 으로 잘못 0:0 이 되지 않게 null 처리한다.
          const text = cleanText(match[1]);
          const value = Number(text);
          return text === "" || !Number.isFinite(value) ? null : value;
        },
      );
      const state = cleanText(header.match(/<span class="timer"><span[^>]*>([\s\S]*?)<\/span><\/span>/i)?.[1] ?? "");
      const locationTimeText = cleanText(segment.match(/<span class="local_time">([\s\S]*?)<\/span>/i)?.[1] ?? "");
      const locationTime = locationTimeText.match(/^(.+)\s+(\d{1,2}:\d{2})$/);
      const away = teams[0];
      const home = teams[1];

      if (!away || !home) {
        return null;
      }

      const rows = parseScoreboardRows(table);
      const awayRow = rows.find((row) => row.team === away);
      const homeRow = rows.find((row) => row.team === home);

      return {
        away,
        home,
        awayScore: Number.isFinite(scores[0]) ? scores[0] : null,
        homeScore: Number.isFinite(scores[1]) ? scores[1] : null,
        state,
        location: locationToKorean(locationTime?.[1] ?? ""),
        rawTime: locationTime?.[2] ?? "",
        linescore: buildLineScoreFromRows(awayRow, homeRow),
      };
    })
    .filter(Boolean);
}

/**
 * 스코어보드 테이블(HTML) 조각에서 팀별 이닝 셀 값을 추출한다.
 * @param {string} table
 * @returns {Array<{team:string,values:string[]}>}
 */
export function parseScoreboardRows(table) {
  return extractRows(table)
    .map((row) => {
      const team = cleanText(row.match(/<th[^>]*scope=["']row["'][^>]*>([\s\S]*?)<\/th>/i)?.[1] ?? "");
      const values = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => cleanText(match[1]));

      if (!team || values.length === 0) {
        return null;
      }

      return { team, values };
    })
    .filter(Boolean);
}

/**
 * away/home 두 행에서 9이닝 라인스코어 배열을 만든다. 한쪽이라도 없으면
 * 전부 null 인 빈 라인스코어를 반환한다.
 * @param {{team:string,values:string[]}|undefined} awayRow
 * @param {{team:string,values:string[]}|undefined} homeRow
 * @returns {Array<{inning:string,away:number|null,home:number|null}>}
 */
export function buildLineScoreFromRows(awayRow, homeRow) {
  if (!awayRow || !homeRow) {
    return emptyLineScore();
  }

  return Array.from({ length: 9 }, (_, index) => ({
    inning: String(index + 1),
    away: normalizeInningScore(awayRow.values[index]),
    home: normalizeInningScore(homeRow.values[index]),
  }));
}

/**
 * 이닝 셀 값을 숫자|null 로 정규화한다("-"/빈값/undefined → null).
 * @param {string|undefined|null} value
 * @returns {number|null}
 */
export function normalizeInningScore(value) {
  if (value === undefined || value === null || value === "" || value === "-") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * 전부 null 인 9이닝 라인스코어 스켈레톤.
 * @returns {Array<{inning:string,away:number|null,home:number|null}>}
 */
export function emptyLineScore() {
  return Array.from({ length: 9 }, (_, index) => ({
    inning: String(index + 1),
    away: null,
    home: null,
  }));
}

/**
 * 영문 구장 코드를 한국어 구장명으로 변환. 매핑 없으면 원문 그대로.
 * @param {string} location
 * @returns {string}
 */
export function locationToKorean(location) {
  const names = {
    DAEJEON: "대전",
    DAEGU: "대구",
    CHANGWON: "창원",
    JAMSIL: "잠실",
    MUNHAK: "문학",
    GWANGJU: "광주",
    GOCHEOKSKY: "고척",
    SUWON: "수원",
    SAJIK: "사직",
  };
  return names[location] ?? location;
}

/**
 * HTML 조각에서 <tr>...</tr> 행 문자열 배열을 추출한다.
 * @param {string} html
 * @returns {string[]}
 */
export function extractRows(html) {
  return [...String(html ?? "").matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
}

/**
 * HTML 태그/엔티티를 제거하고 공백을 정규화한 순수 텍스트를 반환한다.
 * @param {string} value
 * @returns {string}
 */
export function cleanText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 스코어보드 HTML에서 쓰이는 최소 HTML 엔티티만 디코드한다.
 * @param {string} value
 * @returns {string}
 */
export function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
