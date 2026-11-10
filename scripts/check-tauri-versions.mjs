/**
 * Les paquets npm de Tauri et les crates Rust sont-ils sur la même version
 * majeure.mineure ?
 *
 * `tauri android build` (et `ios build`) refuse de construire au moindre
 * écart, mais seulement dans le workflow mobile, lancé à la main ou sur un
 * tag : un `npm update` qui monte `@tauri-apps/api` sans `cargo update` passe
 * donc la CI et ne casse qu'au moment de publier (0.53.0). Ce contrôle relit
 * les deux fichiers de verrouillage et fait échouer `npm run build` tout de
 * suite.
 *
 * Pour corriger un écart : `cargo update -p <crate>` dans `src-tauri/`.
 * `node scripts/check-tauri-versions.mjs`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Paquet npm → crate Rust correspondante. */
function crateFor(pkg) {
  if (pkg === "@tauri-apps/api") return "tauri";
  const official = pkg.match(/^@tauri-apps\/plugin-(.+)$/);
  if (official) return `tauri-plugin-${official[1]}`;
  const community = pkg.match(/^@[^/]+\/(tauri-plugin-.+)-api$/);
  if (community) return community[1];
  return null;
}

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const npmLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const cargoLock = readFileSync(join(root, "src-tauri", "Cargo.lock"), "utf8");

const crateVersions = new Map();
for (const block of cargoLock.split("[[package]]")) {
  const name = block.match(/^name = "([^"]+)"/m)?.[1];
  const version = block.match(/^version = "([^"]+)"/m)?.[1];
  if (name && version) crateVersions.set(name, version);
}

const majorMinor = (v) => v.split(".").slice(0, 2).join(".");

const mismatches = [];
for (const pkg of Object.keys(manifest.dependencies ?? {})) {
  const crate = crateFor(pkg);
  if (!crate) continue;
  const npmVersion = npmLock.packages?.[`node_modules/${pkg}`]?.version;
  const crateVersion = crateVersions.get(crate);
  if (!npmVersion || !crateVersion) {
    mismatches.push(`${pkg} ou ${crate} absent des fichiers de verrouillage`);
  } else if (majorMinor(npmVersion) !== majorMinor(crateVersion)) {
    mismatches.push(`${crate} (v${crateVersion}) : ${pkg} (v${npmVersion})`);
  }
}

if (mismatches.length > 0) {
  console.error("Versions de Tauri désaccordées entre npm et Cargo :");
  for (const line of mismatches) console.error(`  ${line}`);
  console.error("Corriger avec `cargo update -p <crate>` dans src-tauri/.");
  process.exit(1);
}
console.log("Versions de Tauri accordées entre npm et Cargo.");
