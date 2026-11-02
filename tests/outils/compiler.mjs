// 🧪 Transforme un fichier TypeScript du site en JavaScript exécutable par Node (dans tests/.build, ignoré par git)
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SORTIE = path.join(RACINE, "tests", ".build");

/** Compile `src` (chemin depuis la racine) vers tests/.build/`dest` et renvoie l'URL à importer */
export function compiler(src, dest, transformer = (s) => s) {
  const code = transformer(fs.readFileSync(path.join(RACINE, src), "utf8"));
  const js = ts.transpileModule(code, {
    fileName: src,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const f = path.join(SORTIE, dest);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, js);
  return pathToFileURL(f).href;
}
