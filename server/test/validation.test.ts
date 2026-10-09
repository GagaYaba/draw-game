import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IncomingMessage } from "node:http";

import {
  validateSubmitDrawingPayload,
  cloneDrawingDocument,
} from "../src/game/drawing-validation.js";
import {
  generateSecretLevel,
  selectDrawingPrompt,
  shufflePlayerIds,
} from "../src/game/game-random.js";
import { validateSubmitGuessPayload } from "../src/game/guess-validation.js";
import { RoomManagerError } from "../src/rooms/room-types.js";
import {
  getNicknameComparisonKey,
  normalizeNickname,
  normalizeRoomCode,
  validateReadyStatus,
} from "../src/rooms/room-validation.js";
import { isValidClientInstanceId } from "../src/sessions/client-instance-validation.js";
import { validateRestoreSessionPayload } from "../src/sessions/session-validation.js";
import {
  createSessionToken,
  hashSessionToken,
  isValidSessionToken,
  verifySessionToken,
} from "../src/sessions/session-token.js";
import { isSocketOriginAllowed } from "../src/socket/socket-origin-policy.js";
import {
  validateCreateRoomPayload,
  validateJoinRoomPayload,
  validateSetPlayerReadyPayload,
  validateStartGamePayload,
} from "../src/socket/validate-room-payloads.js";
import { DRAWING } from "./helpers.js";

const CLIENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "A".repeat(43);

function throwsCode(action: () => unknown, code: string) {
  assert.throws(
    action,
    (error: unknown) => error instanceof RoomManagerError && error.code === code,
  );
}

describe("pseudonymes, codes de salon et statut prêt", () => {
  const validNicknames: [string, string][] = [
    ["Alice", "Alice"],
    ["  Jean   Pierre ", "Jean Pierre"],
    ["Zoé-2_x", "Zoé-2_x"],
    ["élise", "élise"],
  ];

  for (const [input, expected] of validNicknames) {
    it(`normalise le pseudonyme ${JSON.stringify(input)}`, () => {
      assert.equal(normalizeNickname(input), expected);
    });
  }

  const invalidNicknames: unknown[] = ["", " ", "A", "x".repeat(21), "a<b>", "ab\u0000", 42, null];

  for (const input of invalidNicknames) {
    it(`refuse le pseudonyme ${JSON.stringify(input)}`, () => {
      throwsCode(() => normalizeNickname(input), "INVALID_NICKNAME");
    });
  }

  it("compare les pseudonymes sans tenir compte de la casse", () => {
    assert.equal(getNicknameComparisonKey("alice"), getNicknameComparisonKey("ALICE"));
  });

  const roomCodes: [unknown, string | null][] = [
    ["abcde", "ABCDE"],
    [" 7kxmp ", "7KXMP"],
    ["ABCD", null],
    ["ABCDI", null],
    ["ABCDO", null],
    [12345, null],
  ];

  for (const [input, expected] of roomCodes) {
    it(`normalise le code ${JSON.stringify(input)}`, () => {
      if (expected === null) {
        throwsCode(() => normalizeRoomCode(input), "INVALID_ROOM_CODE");
      } else {
        assert.equal(normalizeRoomCode(input), expected);
      }
    });
  }

  it("n'accepte qu'un booléen comme statut prêt", () => {
    assert.equal(validateReadyStatus(true), true);
    throwsCode(() => validateReadyStatus("true"), "INVALID_READY_STATUS");
  });
});

describe("sessions et jetons", () => {
  it("génère des jetons valides, uniques et vérifiables par empreinte", () => {
    const token = createSessionToken();
    assert.equal(isValidSessionToken(token), true);
    assert.notEqual(token, createSessionToken());
    assert.equal(verifySessionToken(token, hashSessionToken(token)), true);
    assert.equal(verifySessionToken(token, hashSessionToken(TOKEN)), false);
    assert.equal(verifySessionToken(token, "pas-une-empreinte"), false);
  });

  const invalidTokens: unknown[] = ["", "court", `${TOKEN}!`, "A".repeat(44), null, 12];
  for (const token of invalidTokens) {
    it(`refuse le jeton ${JSON.stringify(token)}`, () => {
      assert.equal(isValidSessionToken(token), false);
    });
  }

  const instanceIds: [unknown, boolean][] = [
    [CLIENT_ID, true],
    ["123e4567-e89b-12d3-a456-426614174000", false],
    ["pas-un-uuid", false],
    [undefined, false],
  ];
  for (const [value, expected] of instanceIds) {
    it(`valide l'identifiant d'instance ${JSON.stringify(value)}`, () => {
      assert.equal(isValidClientInstanceId(value), expected);
    });
  }

  const valid = { roomCode: "abcde", playerId: "p1", token: TOKEN, clientInstanceId: CLIENT_ID };
  const restoreCases: [string, unknown, boolean][] = [
    ["charge valide", valid, true],
    ["absente", undefined, false],
    ["clé supplémentaire", { ...valid, extra: 1 }, false],
    ["clé manquante", { roomCode: "ABCDE", playerId: "p1", token: TOKEN }, false],
    ["jeton invalide", { ...valid, token: "x" }, false],
    ["identifiant vide", { ...valid, playerId: "" }, false],
    ["identifiant avec espaces", { ...valid, playerId: " p1" }, false],
    ["instance invalide", { ...valid, clientInstanceId: "x" }, false],
    ["objet sans prototype standard", Object.create({ inherited: true }), false],
  ];
  for (const [label, payload, expected] of restoreCases) {
    it(`restauration : ${label}`, () => {
      assert.equal(validateRestoreSessionPayload(payload).success, expected);
    });
  }

  it("normalise le code de salon d'une restauration valide", () => {
    const result = validateRestoreSessionPayload(valid);
    assert.ok(result.success);
    assert.equal(result.data.roomCode, "ABCDE");
  });
});

describe("charges utiles des commandes", () => {
  const nickname = { nickname: "Alice", clientInstanceId: CLIENT_ID };
  const cases: [string, () => { success: boolean }, boolean][] = [
    ["création valide", () => validateCreateRoomPayload(nickname), true],
    ["création sans objet", () => validateCreateRoomPayload("x"), false],
    [
      "création sans pseudonyme texte",
      () => validateCreateRoomPayload({ ...nickname, nickname: 5 }),
      false,
    ],
    [
      "création instance invalide",
      () => validateCreateRoomPayload({ ...nickname, clientInstanceId: "x" }),
      false,
    ],
    ["jonction valide", () => validateJoinRoomPayload({ ...nickname, roomCode: "ABCDE" }), true],
    ["jonction sans code", () => validateJoinRoomPayload(nickname), false],
    ["jonction code non texte", () => validateJoinRoomPayload({ ...nickname, roomCode: 1 }), false],
    [
      "jonction instance invalide",
      () => validateJoinRoomPayload({ ...nickname, roomCode: "ABCDE", clientInstanceId: 1 }),
      false,
    ],
    ["prêt valide", () => validateSetPlayerReadyPayload({ isReady: false }), true],
    ["prêt invalide", () => validateSetPlayerReadyPayload({ isReady: 1 }), false],
    ["lancement sans donnée", () => validateStartGamePayload(undefined), true],
    ["lancement avec donnée", () => validateStartGamePayload({}), false],
  ];

  for (const [label, run, expected] of cases) {
    it(label, () => {
      assert.equal(run().success, expected);
    });
  }
});

describe("estimations", () => {
  const cases: [string, unknown, boolean][] = [
    ["valide", { turnId: "t1", value: 5 }, true],
    ["bornes", { turnId: "t1", value: 10 }, true],
    ["hors bornes", { turnId: "t1", value: 11 }, false],
    ["zéro", { turnId: "t1", value: 0 }, false],
    ["décimale", { turnId: "t1", value: 5.5 }, false],
    ["texte", { turnId: "t1", value: "5" }, false],
    ["tour vide", { turnId: "", value: 5 }, false],
    ["tour avec espaces", { turnId: " t1", value: 5 }, false],
    ["clé supplémentaire", { turnId: "t1", value: 5, extra: true }, false],
    ["tableau", [], false],
    ["absente", undefined, false],
  ];

  for (const [label, payload, expected] of cases) {
    it(label, () => {
      assert.equal(validateSubmitGuessPayload(payload).success, expected);
    });
  }
});

describe("dessins", () => {
  const stroke = DRAWING.strokes[0];
  const document = (strokes: unknown[], overrides: Record<string, unknown> = {}) => ({
    drawing: { ...DRAWING, strokes, ...overrides },
  });
  const manyStrokes = (count: number, points = 1) =>
    Array.from({ length: count }, () => ({
      ...stroke,
      points: Array.from({ length: points }, () => ({ x: 0.5, y: 0.5 })),
    }));

  const cases: [string, unknown, string][] = [
    ["valide", document([stroke]), "OK"],
    [
      "gomme (couleur remplacée par le fond)",
      document([{ ...stroke, tool: "eraser", color: "#FFFFFF" }]),
      "OK",
    ],
    [
      "pot de peinture",
      document([{ tool: "fill", color: "#C62828", width: 4, points: [{ x: 0.2, y: 0.2 }] }]),
      "OK",
    ],
    [
      "pot de peinture à deux points",
      document([
        {
          tool: "fill",
          color: "#C62828",
          width: 4,
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.3, y: 0.3 },
          ],
        },
      ]),
      "INVALID_DRAWING",
    ],
    [
      "pot de peinture en version 1",
      document([{ tool: "fill", color: "#C62828", width: 4, points: [{ x: 0.2, y: 0.2 }] }], {
        version: 1,
      }),
      "INVALID_DRAWING",
    ],
    ["charge absente", undefined, "INVALID_DRAWING"],
    ["clé supplémentaire", { ...document([stroke]), extra: 1 }, "INVALID_DRAWING"],
    ["format de document inconnu", document([stroke], { aspectRatio: "16:9" }), "INVALID_DRAWING"],
    ["aucun trait", document([]), "EMPTY_DRAWING"],
    ["couleur hors palette", document([{ ...stroke, color: "#123456" }]), "INVALID_DRAWING"],
    ["épaisseur interdite", document([{ ...stroke, width: 5 }]), "INVALID_DRAWING"],
    ["outil inconnu", document([{ ...stroke, tool: "laser" }]), "INVALID_DRAWING"],
    [
      "coordonnée hors zone",
      document([{ ...stroke, points: [{ x: 2, y: 0 }] }]),
      "INVALID_DRAWING",
    ],
    [
      "coordonnée non finie",
      document([{ ...stroke, points: [{ x: Number.NaN, y: 0 }] }]),
      "INVALID_DRAWING",
    ],
    ["trait sans point", document([{ ...stroke, points: [] }]), "INVALID_DRAWING"],
    ["trait non objet", document(["trait"]), "INVALID_DRAWING"],
    ["trop de traits", document(manyStrokes(251)), "DRAWING_TOO_LARGE"],
    ["trop de points par trait", document(manyStrokes(1, 301)), "DRAWING_TOO_LARGE"],
    ["trop de points au total", document(manyStrokes(101, 300)), "DRAWING_TOO_LARGE"],
    [
      "trop de remplissages",
      document(
        Array.from({ length: 17 }, () => ({
          tool: "fill",
          color: "#C62828",
          width: 4,
          points: [{ x: 0.1, y: 0.1 }],
        })),
      ),
      "DRAWING_TOO_LARGE",
    ],
  ];

  for (const [label, payload, expected] of cases) {
    it(label, () => {
      const result = validateSubmitDrawingPayload(payload);
      if (expected === "OK") {
        assert.ok(result.success);
      } else {
        assert.equal(result.success, false);
        assert.equal((result as { error: { code: string } }).error.code, expected);
      }
    });
  }

  it("copie un dessin en profondeur", () => {
    const copy = cloneDrawingDocument(DRAWING);
    assert.deepEqual(copy, DRAWING);
    assert.notEqual(copy.strokes[0], DRAWING.strokes[0]);
    assert.notEqual(copy.strokes[0]?.points[0], DRAWING.strokes[0]?.points[0]);
  });
});

describe("tirages aléatoires", () => {
  it("mélange sans perdre de joueur et reste déterministe avec une source fixe", () => {
    const ids = ["a", "b", "c", "d"];
    const shuffled = shufflePlayerIds(ids, () => 0);
    assert.deepEqual([...shuffled].sort(), ids);
    assert.deepEqual(
      shufflePlayerIds(ids, () => 0),
      shuffled,
    );
  });

  it("choisit une consigne et un niveau dans les bornes", () => {
    const prompts = [
      { id: "a", statement: "a", lowLabel: "b", highLabel: "c", category: "x" },
      { id: "b", statement: "a", lowLabel: "b", highLabel: "c", category: "x" },
    ];
    assert.equal(selectDrawingPrompt(prompts, () => 0.99).id, "b");
    assert.equal(
      generateSecretLevel(() => 0),
      1,
    );
    assert.equal(
      generateSecretLevel(() => 0.999),
      10,
    );
    assert.throws(() => selectDrawingPrompt([], () => 0), RangeError);
    assert.throws(() => generateSecretLevel(() => 1), RangeError);
    assert.throws(() => generateSecretLevel(() => Number.NaN), RangeError);
  });
});

describe("politique d'origine WebSocket", () => {
  const request = (headers: Record<string, string>) => ({ headers }) as unknown as IncomingMessage;
  const cases: [
    string,
    Record<string, string>,
    Parameters<typeof isSocketOriginAllowed>[1],
    boolean,
  ][] = [
    ["sans origine", { host: "jeu.example" }, {}, true],
    ["même hôte", { origin: "https://jeu.example", host: "jeu.example" }, {}, true],
    [
      "hôte transmis par le proxy",
      { origin: "https://jeu.example", host: "interne:3000", "x-forwarded-host": "jeu.example" },
      {},
      true,
    ],
    ["origine étrangère", { origin: "https://evil.example", host: "jeu.example" }, {}, false],
    ["origine non HTTP", { origin: "file://x", host: "jeu.example" }, {}, false],
    ["origine illisible", { origin: "pas une url", host: "jeu.example" }, {}, false],
    ["origine nulle", { origin: "null", host: "jeu.example" }, {}, false],
    ["hôte absent", { origin: "https://jeu.example" }, {}, false],
    ["hôte illisible", { origin: "https://jeu.example", host: "ex ample" }, {}, false],
    [
      "origine explicitement autorisée",
      { origin: "https://autre.example", host: "jeu.example" },
      { allowedOrigins: ["https://autre.example"] },
      true,
    ],
    [
      "boucle locale sur un autre port",
      { origin: "http://localhost:5173", host: "localhost:3000" },
      { allowLoopbackPortMismatch: true },
      true,
    ],
    [
      "boucle locale sans autorisation",
      { origin: "http://localhost:5173", host: "localhost:3000" },
      {},
      false,
    ],
    [
      "boucle locale vers un hôte public",
      { origin: "http://localhost:5173", host: "jeu.example" },
      { allowLoopbackPortMismatch: true },
      false,
    ],
  ];

  for (const [label, headers, options, expected] of cases) {
    it(label, () => {
      assert.equal(isSocketOriginAllowed(request(headers), options), expected);
    });
  }
});
