// 🧪 Noms affichés « Prénom N. » dans l'admin (le nom complet reste enregistré)
import { test } from "node:test";
import assert from "node:assert/strict";
import { compiler } from "./outils/compiler.mjs";

const T = await import(compiler("src/lib/types.ts", "types-noms.mjs"));

test("noms courts : prénom + initiale, et assez de lettres pour distinguer les homonymes", () => {
  const c = T.nomsCourtsUniques(["Julie Martin", "Julie Moreau", "Paul Petit", "Zoé", " Paul Petit ", "Marc Durand", "Marc Dupont"]);
  assert.equal(c.get("Paul Petit"), "Paul P.");
  assert.equal(c.get("Zoé"), "Zoé");
  assert.equal(c.get("Julie Martin"), "Julie Ma.");
  assert.equal(c.get("Julie Moreau"), "Julie Mo.");
  assert.equal(c.get("Marc Durand"), "Marc Dur.");
  assert.equal(c.get("Marc Dupont"), "Marc Dup.");
  assert.equal(new Set(c.values()).size, c.size, "aucun doublon à l'affichage");
});

test("binôme court : adhérents reconnus, personne extérieure raccourcie aussi", () => {
  const c = T.nomsCourtsUniques(["Julie Martin", "Julie Moreau"]);
  assert.equal(T.binomeCourt("Julie Martin / Karim Benali", c), "Julie Ma. / Karim B.");
  assert.equal(T.binomeCourt("Julie Moreau / Zoé", c), "Julie Mo. / Zoé");
  assert.equal(T.binomeCourt("", c), "");
});
