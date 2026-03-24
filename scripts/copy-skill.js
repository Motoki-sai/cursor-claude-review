const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src", "SKILL.md");
const dest = path.join(root, "out", "SKILL.md");

if (!fs.existsSync(src)) {
  console.warn("copy-skill: src/SKILL.md not found, skipping");
  process.exit(0);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("copy-skill: src/SKILL.md -> out/SKILL.md");
