import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DrawingDocument } from "@drawing-game/shared";

import {
  CLIENT_INSTANCE_STORAGE_KEY,
  getOrCreateClientInstanceId,
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
  constructor(private readonly failing: "get" | "set" | "all" | null = null) {}

  getItem(key: string) {
    if (this.failing === "get" || this.failing === "all") throw new Error("lecture interdite");
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failing === "set" || this.failing === "all") throw new Error("écriture interdite");
    this.values.set(key, value);
  }

  removeItem(key: string) {
    if (this.failing === "all") throw new Error("suppression interdite");
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

describe("stockage local du navigateur", () => {
  // Risque : un stockage corrompu ou indisponible ne doit jamais empêcher de jouer ni restaurer à tort.
  it("écrit, relit et efface la session et les brouillons, en tolérant corruption et pannes", () => {
    for (const module of modules) {
      const storage = new FakeStorage();
      assert.equal(module.write(storage), true, `${module.name} : écriture`);
      assert.deepEqual(module.read(storage), module.valid, `${module.name} : relecture`);
      module.clear(storage);
      assert.equal(module.read(storage), null, `${module.name} : effacement`);

      const corrupted = [
        "{pas du json",
        JSON.stringify([1, 2, 3]),
        JSON.stringify({ ...(module.valid as object), extra: 1 }),
        module.oversized,
      ];
      for (const serialized of corrupted) {
        storage.values.set(module.key, serialized);
        assert.equal(module.read(storage), null, `${module.name} : valeur corrompue`);
        assert.equal(storage.values.has(module.key), false, `${module.name} : valeur supprimée`);
      }

      assert.equal(module.parse(null), null, module.name);
      assert.equal(module.read(null), null, `${module.name} : sans stockage`);
      assert.equal(module.write(null), false, `${module.name} : sans stockage`);
      module.clear(null);
      assert.equal(
        module.write(new FakeStorage("set")),
        false,
        `${module.name} : écriture en panne`,
      );
      assert.equal(module.read(new FakeStorage("all")), null, `${module.name} : lecture en panne`);
      module.clear(new FakeStorage("all"));
      assert.equal(
        module.read(undefined as unknown as null),
        null,
        `${module.name} : sans navigateur`,
      );
    }
  });

  // Risque : appliquer le brouillon ou l'identifiant d'un autre tour, d'une autre partie ou d'un autre onglet.
  it("n'applique un brouillon qu'à son contexte exact et gère l'identifiant d'instance", () => {
    for (const other of [
      { ...CONTEXT, roomCode: "ZZZZZ" },
      { ...CONTEXT, gameId: "autre" },
      { ...CONTEXT, turnId: "autre" },
      { ...CONTEXT, playerId: "autre" },
    ]) {
      assert.equal(matchesGuessDraftContext(GUESS_DRAFT, other), false);
      assert.equal(matchesDrawingDraftContext(DRAWING_DRAFT, other), false);
    }
    assert.equal(matchesGuessDraftContext(GUESS_DRAFT, CONTEXT), true);
    assert.equal(matchesDrawingDraftContext(DRAWING_DRAFT, CONTEXT), true);

    const invalidDrafts: Record<string, unknown>[] = [
      { selectedTool: "laser" },
      { selectedColor: "#123456" },
      { selectedWidth: 5 },
      { turnId: "tour 1" },
      { savedAt: -1 },
      { drawing: { ...DRAWING, strokes: [{ tool: "pen" }] } },
      { drawing: { ...DRAWING, version: 3 } },
    ];
    for (const override of invalidDrafts) {
      assert.equal(parseStoredDrawingDraft({ ...DRAWING_DRAFT, ...override }), null);
    }
    assert.equal(parseStoredGuessDraft({ ...GUESS_DRAFT, value: 11 }), null);
    assert.equal(parseStoredSession({ ...SESSION, token: "court" }), null);
    assert.equal(parseStoredSession({ ...SESSION, roomCode: "abc" }), null);

    const id = "123e4567-e89b-42d3-a456-426614174000";
    const storage = new FakeStorage();
    assert.equal(
      getOrCreateClientInstanceId(storage, () => id),
      id,
    );
    assert.equal(
      getOrCreateClientInstanceId(storage, () => assert.fail("pas de nouvel id")),
      id,
    );
    storage.values.set(CLIENT_INSTANCE_STORAGE_KEY, "pas-un-uuid");
    assert.equal(readClientInstanceId(storage), null);
    assert.equal(
      getOrCreateClientInstanceId(new FakeStorage("set"), () => id),
      id,
    );
    assert.equal(
      getOrCreateClientInstanceId(null, () => id),
      id,
    );
    assert.throws(() => getOrCreateClientInstanceId(new FakeStorage(), () => "invalide"), Error);
  });
});
