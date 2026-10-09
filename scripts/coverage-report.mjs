// Résume la couverture par périmètre à partir de coverage/coverage-summary.json.
// Les fichiers jamais exécutés sont comptés (option `all` de c8) : aucune exclusion cachée.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const summary = JSON.parse(
  readFileSync(resolve(root, "coverage", "coverage-summary.json"), "utf8"),
);

const scopes = new Map();
const addTo = (name, metrics) => {
  const scope = scopes.get(name) ?? { files: 0, neverRun: 0, total: 0, covered: 0 };
  scope.files += 1;
  scope.total += metrics.lines.total;
  scope.covered += metrics.lines.covered;
  if (metrics.lines.covered === 0 && metrics.lines.total > 0) {
    scope.neverRun += 1;
  }
  scopes.set(name, scope);
};

for (const [file, metrics] of Object.entries(summary)) {
  if (file === "total") {
    continue;
  }

  const path = relative(root, file).split(sep).join("/");
  const workspace = path.split("/")[0];
  addTo(workspace, metrics);
  if (path.startsWith("client/src/components/")) {
    addTo("client (composants React)", metrics);
  } else if (workspace === "client") {
    addTo("client (hors composants React)", metrics);
  }
}

const rows = [...scopes.entries()].map(([name, scope]) => ({
  périmètre: name,
  fichiers: scope.files,
  "jamais exécutés": scope.neverRun,
  lignes: `${scope.covered}/${scope.total}`,
  couverture: `${((100 * scope.covered) / scope.total).toFixed(1)} %`,
}));

const all = Object.entries(summary).filter(([file]) => file !== "total");
const totalLines = all.reduce((sum, [, metrics]) => sum + metrics.lines.total, 0);
const coveredLines = all.reduce((sum, [, metrics]) => sum + metrics.lines.covered, 0);
rows.push({
  périmètre: "total",
  fichiers: all.length,
  "jamais exécutés": all.filter(([, metrics]) => metrics.lines.covered === 0).length,
  lignes: `${coveredLines}/${totalLines}`,
  couverture: `${((100 * coveredLines) / totalLines).toFixed(1)} %`,
});

console.table(rows);

// Détail par fichier : `node scripts/coverage-report.mjs --files server/src`
const filesFlag = process.argv.indexOf("--files");
if (filesFlag !== -1) {
  const prefix = process.argv[filesFlag + 1] ?? "";
  const detail = all
    .map(([file, metrics]) => ({
      fichier: relative(root, file).split(sep).join("/"),
      "lignes non couvertes": metrics.lines.total - metrics.lines.covered,
      lignes: metrics.lines.total,
    }))
    .filter((row) => row.fichier.startsWith(prefix))
    .sort((a, b) => b["lignes non couvertes"] - a["lignes non couvertes"]);
  console.table(detail);
}
