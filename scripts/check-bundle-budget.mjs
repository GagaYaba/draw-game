// Budget de poids du client : échoue si un fichier compressé dépasse son seuil.
// À exécuter après `npm run build`. Seuils justifiés dans docs/performance.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const distDirectory = new URL("../client/dist/", import.meta.url);
const KB = 1024;
const BUDGET = {
  scriptGzipKb: 130,
  styleGzipKb: 25,
  imageKb: 100,
};

const list = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? list(path) : [path];
  });

const root = distDirectory.pathname.replace(/^\/([A-Za-z]:)/u, "$1");
const files = list(root);
const rows = [];
let exceeded = 0;

const check = (label, size, limitKb) => {
  const ok = size <= limitKb * KB;
  if (!ok) exceeded += 1;
  rows.push(`${ok ? "ok " : "KO "} ${label} : ${(size / KB).toFixed(1)} Ko (max ${limitKb} Ko)`);
};

for (const file of files) {
  const name = file.slice(root.length).replaceAll("\\", "/");
  if (name.endsWith(".js"))
    check(`${name} (gzip)`, gzipSync(readFileSync(file)).length, BUDGET.scriptGzipKb);
  else if (name.endsWith(".css"))
    check(`${name} (gzip)`, gzipSync(readFileSync(file)).length, BUDGET.styleGzipKb);
  else if (name.endsWith(".png")) check(name, statSync(file).size, BUDGET.imageKb);
}

console.log(rows.join("\n"));
if (exceeded > 0) {
  console.error(`${exceeded} fichier(s) au-dessus du budget.`);
  process.exit(1);
}
console.log("Budget de poids respecté.");
