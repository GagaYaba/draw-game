import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { describe, it } from "node:test";

import {
  cloneDrawingDocument,
  validateSubmitDrawingPayload,
} from "../src/game/drawing-validation.js";
import { validateSubmitGuessPayload } from "../src/game/guess-validation.js";
import { RoomManagerError } from "../src/rooms/room-types.js";
import { normalizeNickname, normalizeRoomCode } from "../src/rooms/room-validation.js";
import { validateRestoreSessionPayload } from "../src/sessions/session-validation.js";
import {
  createSessionToken,
  hashSessionToken,
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

function rejects(action: () => unknown, code: string, label: string) {
  assert.throws(
    action,
    (error: unknown) => error instanceof RoomManagerError && error.code === code,
    label,
  );
}

describe("validation des saisies", () => {
  // Risque : le serveur ne doit jamais faire confiance au client (injection, données mal formées).
  it("normalise ou refuse les pseudonymes, les codes de salon et les charges des commandes", () => {
    assert.equal(normalizeNickname("  Jean   Pierre "), "Jean Pierre");
    assert.equal(normalizeNickname("élise"), "élise");
    for (const nickname of ["", " ", "A", "x".repeat(21), "a<b>", "ab\u0000", 42, null]) {
      rejects(() => normalizeNickname(nickname), "INVALID_NICKNAME", JSON.stringify(nickname));
    }

    assert.equal(normalizeRoomCode(" 7kxmp "), "7KXMP");
    for (const code of ["ABCD", "ABCDI", "ABCDO", 12345]) {
      rejects(() => normalizeRoomCode(code), "INVALID_ROOM_CODE", JSON.stringify(code));
    }

    const nickname = { nickname: "Alice", clientInstanceId: CLIENT_ID };
    const commands: [string, { success: boolean }, boolean][] = [
      ["création valide", validateCreateRoomPayload(nickname), true],
      ["création sans objet", validateCreateRoomPayload("x"), false],
      [
        "création, pseudonyme non texte",
        validateCreateRoomPayload({ ...nickname, nickname: 5 }),
        false,
      ],
      [
        "création, instance invalide",
        validateCreateRoomPayload({ ...nickname, clientInstanceId: "x" }),
        false,
      ],
      ["jonction valide", validateJoinRoomPayload({ ...nickname, roomCode: "ABCDE" }), true],
      ["jonction sans code", validateJoinRoomPayload(nickname), false],
      ["prêt valide", validateSetPlayerReadyPayload({ isReady: false }), true],
      ["prêt invalide", validateSetPlayerReadyPayload({ isReady: 1 }), false],
      ["lancement sans donnée", validateStartGamePayload(undefined), true],
      ["lancement avec donnée", validateStartGamePayload({}), false],
    ];
    for (const [label, result, expected] of commands) {
      assert.equal(result.success, expected, label);
    }
  });

  // Risque : un jeton ou une estimation falsifiés permettent de prendre la place d'un joueur ou de tricher.
  it("valide les sessions, les jetons et les estimations", () => {
    const token = createSessionToken();
    assert.equal(verifySessionToken(token, hashSessionToken(token)), true);
    assert.equal(verifySessionToken(token, hashSessionToken(TOKEN)), false);
    assert.equal(verifySessionToken(token, "pas-une-empreinte"), false);

    const valid = { roomCode: "abcde", playerId: "p1", token: TOKEN, clientInstanceId: CLIENT_ID };
    const sessions: [string, unknown, boolean][] = [
      ["valide", valid, true],
      ["absente", undefined, false],
      ["clé supplémentaire", { ...valid, extra: 1 }, false],
      ["clé manquante", { roomCode: "ABCDE", playerId: "p1", token: TOKEN }, false],
      ["jeton invalide", { ...valid, token: "x" }, false],
      ["identifiant vide", { ...valid, playerId: "" }, false],
      ["instance invalide", { ...valid, clientInstanceId: "x" }, false],
      ["prototype inattendu", Object.create({ inherited: true }), false],
    ];
    for (const [label, payload, expected] of sessions) {
      assert.equal(validateRestoreSessionPayload(payload).success, expected, label);
    }

    const guesses: [string, unknown, boolean][] = [
      ["valide", { turnId: "t1", value: 5 }, true],
      ["borne haute", { turnId: "t1", value: 10 }, true],
      ["hors bornes", { turnId: "t1", value: 11 }, false],
      ["décimale", { turnId: "t1", value: 5.5 }, false],
      ["texte", { turnId: "t1", value: "5" }, false],
      ["tour vide", { turnId: "", value: 5 }, false],
      ["clé supplémentaire", { turnId: "t1", value: 5, extra: true }, false],
      ["absente", undefined, false],
    ];
    for (const [label, payload, expected] of guesses) {
      assert.equal(validateSubmitGuessPayload(payload).success, expected, label);
    }
  });

  // Risque : un dessin hors limites sature la mémoire ou le réseau (message jusqu'à 2,5 Mo).
  it("accepte un dessin valide et refuse les dessins invalides ou trop volumineux", () => {
    const stroke = DRAWING.strokes[0];
    const document = (strokes: unknown[], overrides: Record<string, unknown> = {}) => ({
      drawing: { ...DRAWING, strokes, ...overrides },
    });
    const many = (count: number, points = 1) =>
      Array.from({ length: count }, () => ({
        ...stroke,
        points: Array.from({ length: points }, () => ({ x: 0.5, y: 0.5 })),
      }));
    const fill = { tool: "fill", color: "#C62828", width: 4, points: [{ x: 0.2, y: 0.2 }] };

    const cases: [string, unknown, string][] = [
      ["valide", document([stroke]), "OK"],
      ["gomme", document([{ ...stroke, tool: "eraser", color: "#FFFFFF" }]), "OK"],
      ["pot de peinture", document([fill]), "OK"],
      ["pot de peinture en version 1", document([fill], { version: 1 }), "INVALID_DRAWING"],
      ["charge absente", undefined, "INVALID_DRAWING"],
      ["format inconnu", document([stroke], { aspectRatio: "16:9" }), "INVALID_DRAWING"],
      ["aucun trait", document([]), "EMPTY_DRAWING"],
      ["couleur hors palette", document([{ ...stroke, color: "#123456" }]), "INVALID_DRAWING"],
      ["épaisseur interdite", document([{ ...stroke, width: 5 }]), "INVALID_DRAWING"],
      [
        "coordonnée hors zone",
        document([{ ...stroke, points: [{ x: 2, y: 0 }] }]),
        "INVALID_DRAWING",
      ],
      ["trop de traits", document(many(251)), "DRAWING_TOO_LARGE"],
      ["trop de points par trait", document(many(1, 301)), "DRAWING_TOO_LARGE"],
      ["trop de points au total", document(many(101, 300)), "DRAWING_TOO_LARGE"],
      [
        "trop de remplissages",
        document(Array.from({ length: 17 }, () => fill)),
        "DRAWING_TOO_LARGE",
      ],
    ];
    for (const [label, payload, expected] of cases) {
      const result = validateSubmitDrawingPayload(payload);
      if (expected === "OK") {
        assert.ok(result.success, label);
      } else {
        assert.equal(result.success, false, label);
        assert.equal((result as { error: { code: string } }).error.code, expected, label);
      }
    }

    const copy = cloneDrawingDocument(DRAWING);
    assert.deepEqual(copy, DRAWING);
    assert.notEqual(copy.strokes[0]?.points[0], DRAWING.strokes[0]?.points[0]);
  });

  // Risque : un site tiers ouvert dans le navigateur d'un joueur ne doit pas pouvoir piloter le serveur.
  it("n'accepte que les origines WebSocket autorisées", () => {
    const request = (headers: Record<string, string>) =>
      ({ headers }) as unknown as IncomingMessage;
    const cases: [
      string,
      Record<string, string>,
      Parameters<typeof isSocketOriginAllowed>[1],
      boolean,
    ][] = [
      ["sans origine", { host: "jeu.example" }, {}, true],
      ["même hôte", { origin: "https://jeu.example", host: "jeu.example" }, {}, true],
      [
        "hôte du proxy",
        { origin: "https://jeu.example", host: "interne:3000", "x-forwarded-host": "jeu.example" },
        {},
        true,
      ],
      ["origine étrangère", { origin: "https://evil.example", host: "jeu.example" }, {}, false],
      ["origine non HTTP", { origin: "file://x", host: "jeu.example" }, {}, false],
      ["origine illisible", { origin: "pas une url", host: "jeu.example" }, {}, false],
      ["hôte absent", { origin: "https://jeu.example" }, {}, false],
      [
        "origine explicitement autorisée",
        { origin: "https://autre.example", host: "jeu.example" },
        { allowedOrigins: ["https://autre.example"] },
        true,
      ],
      [
        "boucle locale en développement",
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
    ];
    for (const [label, headers, options, expected] of cases) {
      assert.equal(isSocketOriginAllowed(request(headers), options), expected, label);
    }
  });
});
