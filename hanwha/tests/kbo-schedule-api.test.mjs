import assert from "node:assert/strict";
import test from "node:test";

import { mergeScheduleMonths, parseKoreanScheduleRows } from "../scripts/kbo-schedule-api.mjs";

const completedGameRows = [
  {
    row: [
      { Text: "06.02(화)", Class: "day" },
      { Text: "<b>18:30</b>", Class: "time" },
      {
        Text: '<span>한화</span><em><span class="lose">3</span><span>vs</span><span class="win">5</span></em><span>두산</span>',
        Class: "play",
      },
      { Text: "", Class: "relay" },
      { Text: "" },
      { Text: "KN-T" },
      { Text: "" },
      { Text: "잠실" },
      { Text: "-" },
    ],
  },
];

const upcomingGameRows = [
  {
    row: [
      { Text: "07.01(수)", Class: "day" },
      { Text: "<b>18:30</b>", Class: "time" },
      { Text: "<span>KT</span><em><span>vs</span></em><span>한화</span>", Class: "play" },
      { Text: "", Class: "relay" },
      { Text: "" },
      { Text: "" },
      { Text: "" },
      { Text: "대전" },
      { Text: "-" },
    ],
  },
];

test("parseKoreanScheduleRows returns a recent Hanwha result when KBO row contains scores", () => {
  const [game] = parseKoreanScheduleRows(completedGameRows);

  assert.deepEqual(game, {
    type: "recent",
    status: "최근 결과",
    date: "06.02",
    time: "화 18:30",
    rawTime: "18:30",
    location: "잠실",
    home: "두산",
    away: "한화",
    score: "패 3:5",
    rawScore: "3:5",
    detail: "잠실 경기",
  });
});

test("parseKoreanScheduleRows returns an upcoming next-month home game when score is absent", () => {
  const [game] = parseKoreanScheduleRows(upcomingGameRows);

  assert.deepEqual(game, {
    type: "upcoming",
    status: "예정 경기",
    date: "07.01",
    time: "수 18:30",
    rawTime: "18:30",
    location: "대전",
    home: "한화",
    away: "KT",
    score: "경기전",
    rawScore: ":",
    detail: "한화 홈 경기",
  });
});

test("mergeScheduleMonths preserves order and removes duplicate games from overlapping month feeds", () => {
  const current = parseKoreanScheduleRows([...completedGameRows, ...upcomingGameRows]);
  const next = parseKoreanScheduleRows(upcomingGameRows);

  const merged = mergeScheduleMonths([current, next]);

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((game) => `${game.date}|${game.rawTime}|${game.away}|${game.home}`),
    ["06.02|18:30|한화|두산", "07.01|18:30|KT|한화"],
  );
});
