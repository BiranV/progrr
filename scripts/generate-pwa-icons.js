/* Generates padded PWA icons from the official logo.
  Input:  public/progrr-logo.png
   Output: public/*.png
*/

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const inputPath = path.join(root, "public", "progrr-logo.png");
const outputDir = path.join(root, "public");

const BG = "#216FF3";
const LOGO_SCALE = 0.85;

async function ensureInput() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input logo: ${ inputPath }`);
  }
}

async function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateSquareIcon(size, outName) {
  const outPath = path.join(outputDir, outName);
  const inner = Math.max(1, Math.round(size * LOGO_SCALE));

  const logo = await sharp(inputPath)
    .ensureAlpha()
    .resize(inner, inner, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);

  return outPath;
}

async function main() {
  await ensureInput();
  await ensureOutputDir();

  const outputs = [];

  outputs.push(await generateSquareIcon(180, "apple-touch-icon.png"));
  outputs.push(await generateSquareIcon(192, "icon-192.png"));
  outputs.push(await generateSquareIcon(512, "icon-512.png"));

  // eslint-disable-next-line no-console
  console.log("Generated PWA icons:\n" + outputs.map((p) => "- " + p).join("\n"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
