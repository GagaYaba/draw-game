import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DrawingDocument } from "@drawing-game/shared";

import { createManualSessionRestoreGate } from "../src/session/manual-session-restore";
import {
  CLIENT_INSTANCE_STORAGE_KEY,
  getOrCreateClientInstanceId,
  isClientInstanceId,
  readClientInstanceId,
} from "../src/session/client-instance";
import {
  clearStoredDrawingDraft,
  matchesDrawingDraftContext,
  parseStoredDrawingDraft,
  readStoredDrawingDraft,
  STORED_DRAWING_DRAFT_KEY,
  type StoredDrawingDraft,
  writeStoredDrawingDraft,
} from "../src/session/stored-drawing-draft";
import {
  clearStoredGuessDraft,
  matchesGuessDraftContext,
  parseStoredGuessDraft,
  readStoredGuessDraft,
  STORED_GUESS_DRAFT_KEY,
  type StoredGuessDraft,
  writeStoredGuessDraft,
} from "../src/session/stored-guess-draft";
import {
  type BrowserStorage,
  clearStoredSession,
  parseStoredSession,
  readStoredSession,
  STORED_SESSION_KEY,
  writeStoredSession,
} from "../src/session/stored-session";

class FakeStorage implements BrowserStorage {
  readonly values = new Map<string, string>();
  constructor(private readonly failing: "get" | "set" | "remove" | "all" | null = null) {}

  getItem(key: string) {
    if (this.failing === "get" || this.failing === "all") throw new Error("lecture interdite");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failing === "set" || this.failing === "all") throw new Error("écriture interdite");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    if (this.failing === "remove" || this.failing === "all")
      throw new Error("suppression interdite");
    this.values.delete(key);
  }
}

const SESSION = { roomCode: "ABCDE", playerId: "player-1", token: "A".repeat(43) };
const CONTEXT = { roomCode: "ABCDE", gameId: "game-1", turnId: "turn-1", playerId: "player-1" };
const DRAWING: DrawingDocument = {
  version: 2,
  aspectRatio: "4:3",
  backgroundColor: "#FFFFFF",
  strokes: [
    {
      tool: "pen",
      color: "#111111",
      width: 4,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
    },
  ],
};
const GUESS_DRAFT: StoredGuessDraft = { ...CONTEXT, value: 7, savedAt: 1 };
const DRAWING_DRAFT: StoredDrawingDraft = {
  ...CONTEXT,
  drawing: DRAWING,
  selectedTool: "pen",
  selectedColor: "#111111",
  selectedWidth: 4,
  savedAt: 1,
};

interface StorageModule {
  name: string;
  key: string;
  valid: unknown;
  oversized: string;
  read: (storage: BrowserStorage | null) => unknown;
  write: (storage: BrowserStorage | null) => boolean;
  clear: (storage: BrowserStorage | null) => void;
  parse: (value: unknown) => unknown;
}

const modules: StorageModule[] = [
  {
    name: "session",
    key: STORED_SESSION_KEY,
    valid: SESSION,
    oversized: "x".repeat(2_049),
    read: (storage) => readStoredSession(storage),
    write: (storage) => writeStoredSession(SESSION, storage),
    clear: (storage) => clearStoredSession(storage),
    parse: parseStoredSession,
  },
  {
    name: "brouillon d'estimation",
    key: STORED_GUESS_DRAFT_KEY,
    valid: GUESS_DRAFT,
    oversized: "x".repeat(2_049),
    read: (storage) => readStoredGuessDraft(storage),
    write: (storage) => writeStoredGuessDraft(GUESS_DRAFT, storage),
    clear: (storage) => clearStoredGuessDraft(storage),
    parse: parseStoredGuessDraft,
  },
  {
    name: "brouillon de dessin",
    key: STORED_DRAWING_DRAFT_KEY,
    valid: DRAWING_DRAFT,
    oversized: "x".repeat(2_500_001),
    read: (storage) => readStoredDrawingDraft(storage),
    write: (storage) => writeStoredDrawingDraft(DRAWING_DRAFT, storage),
    clear: (storage) => clearStoredDrawingDraft(storage),
    parse: parseStoredDrawingDraft,
  },
];

for (const module of modules) {
  describe(`stockage local : ${module.name}`, () => {
    it("écrit puis relit la valeur, et l'efface", () => {
      const storage = new FakeStorage();

      assert.equal(module.write(storage), true);
      assert.deepEqual(module.read(storage), module.valid);
      module.clear(storage);
      assert.equal(module.read(storage), null);
    });

    const corrupted: [string, string][] = [
      ["JSON illisible", "{pas du json"],
      ["valeur de mauvais type", JSON.stringify([1, 2, 3])],
      ["clé supplémentaire", JSON.stringify({ ...(module.valid as object), extra: 1 })],
    ];
    for (const [label, serialized] of corrupted) {
      it(`supprime une valeur corrompue (${label})`, () => {
        const storage = new FakeStorage();
        storage.values.set(module.key, serialized);

        assert.equal(module.read(storage), null);
        assert.equal(storage.values.has(module.key), false);
      });
    }

    it("supprime une valeur trop volumineuse", () => {
      const storage = new FakeStorage();
      storage.values.set(module.key, module.oversized);

      assert.equal(module.read(storage), null);
      assert.equal(storage.values.has(module.key), false);
    });

    it("reste silencieux sans stockage ou avec un stockage qui échoue", () => {
      assert.equal(module.read(null), null);
      assert.equal(module.write(null), false);
      module.clear(null);

      assert.equal(module.write(new FakeStorage("set")), false);
      assert.equal(module.read(new FakeStorage("get")), null);
      assert.equal(module.read(new FakeStorage("all")), null);
      module.clear(new FakeStorage("remove"));
    });

    it("refuse les valeurs invalides", () => {
      assert.equal(module.parse(null), null);
      assert.equal(module.parse("texte"), null);
      assert.equal(module.parse({}), null);
    });

    it("n'utilise aucun stockage sans navigateur", () => {
      assert.equal(module.read(undefined as unknown as null), null);
    });
  });
}

describe("brouillons : contexte et contenu", () => {
  const otherContexts = [
    { ...CONTEXT, roomCode: "ZZZZZ" },
    { ...CONTEXT, gameId: "autre" },
    { ...CONTEXT, turnId: "autre" },
    { ...CONTEXT, playerId: "autre" },
  ];

  it("reconnaît uniquement le contexte exact", () => {
    assert.equal(matchesGuessDraftContext(GUESS_DRAFT, CONTEXT), true);
    assert.equal(matchesDrawingDraftContext(DRAWING_DRAFT, CONTEXT), true);
    for (const context of otherContexts) {
      assert.equal(matchesGuessDraftContext(GUESS_DRAFT, context), false);
      assert.equal(matchesDrawingDraftContext(DRAWING_DRAFT, context), false);
    }
  });

  const invalidFields: [string, Record<string, unknown>][] = [
    ["code de salon", { roomCode: "ABCDO" }],
    ["identifiant vide", { gameId: "" }],
    ["identifiant avec espace", { turnId: "tour 1" }],
    ["horodatage négatif", { savedAt: -1 }],
    ["outil inconnu", { selectedTool: "laser" }],
    ["couleur hors palette", { selectedColor: "#123456" }],
    ["épaisseur interdite", { selectedWidth: 5 }],
    ["dessin invalide", { drawing: { ...DRAWING, strokes: [{ tool: "pen" }] } }],
    ["dessin d'une autre version", { drawing: { ...DRAWING, version: 3 } }],
  ];
  for (const [label, override] of invalidFields) {
    it(`refuse un brouillon de dessin avec ${label} invalide`, () => {
      assert.equal(parseStoredDrawingDraft({ ...DRAWING_DRAFT, ...override }), null);
    });
  }

  it("refuse une estimation hors bornes", () => {
    assert.equal(parseStoredGuessDraft({ ...GUESS_DRAFT, value: 11 }), null);
    assert.equal(parseStoredGuessDraft({ ...GUESS_DRAFT, value: 5.5 }), null);
  });
});

describe("session : identifiants", () => {
  const invalid: [string, Record<string, unknown>][] = [
    ["code de salon", { roomCode: "abc" }],
    ["identifiant de joueur", { playerId: " p" }],
    ["jeton", { token: "court" }],
  ];
  for (const [label, override] of invalid) {
    it(`refuse un ${label} invalide`, () => {
      assert.equal(parseStoredSession({ ...SESSION, ...override }), null);
      assert.equal(writeStoredSession({ ...SESSION, ...override }, new FakeStorage()), false);
    });
  }
});

describe("identifiant d'instance cliente", () => {
  const ID = "123e4567-e89b-42d3-a456-426614174000";

  it("crée puis conserve un identifiant par session de navigation", () => {
    const storage = new FakeStorage();
    const first = getOrCreateClientInstanceId(storage, () => ID);

    assert.equal(first, ID);
    assert.equal(storage.values.get(CLIENT_INSTANCE_STORAGE_KEY), ID);
    assert.equal(
      getOrCreateClientInstanceId(storage, () => assert.fail("pas de nouvel id")),
      ID,
    );
    assert.equal(readClientInstanceId(storage), ID);
  });

  it("remplace une valeur stockée invalide et fonctionne sans stockage", () => {
    const storage = new FakeStorage();
    storage.values.set(CLIENT_INSTANCE_STORAGE_KEY, "pas-un-uuid");

    assert.equal(readClientInstanceId(storage), null);
    assert.equal(storage.values.has(CLIENT_INSTANCE_STORAGE_KEY), false);
    assert.equal(
      getOrCreateClientInstanceId(null, () => ID),
      ID,
    );
    assert.equal(
      getOrCreateClientInstanceId(new FakeStorage("set"), () => ID),
      ID,
    );
    assert.equal(readClientInstanceId(null), null);
    assert.equal(readClientInstanceId(new FakeStorage("all")), null);
    assert.ok(isClientInstanceId(getOrCreateClientInstanceId(new FakeStorage())));
  });

  it("refuse une fabrique qui produit un identifiant invalide", () => {
    assert.throws(() => getOrCreateClientInstanceId(new FakeStorage(), () => "invalide"), Error);
  });
});

describe("restauration manuelle", () => {
  it("n'autorise qu'une restauration à la fois", () => {
    const gate = createManualSessionRestoreGate();

    assert.equal(gate.isInFlight(), false);
    assert.equal(gate.begin(), true);
    assert.equal(gate.begin(), false);
    assert.equal(gate.isInFlight(), true);
    gate.finish();
    assert.equal(gate.begin(), true);
  });
});
