/* Generates padded PWA icons so the logo appears smaller inside the square.
  Input:  public/logo-new.png
   Output: public/icons/*.png
*/

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const inputPath = path.join(root, "public", "logo-new.png");
const outputDir = path.join(root, "public", "icons");

const BG = "#ffffff";
const LOGO_SCALE = 0.66; // smaller logo inside square

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
    .resize(inner, inner, { fit: "contain", withoutEnlargement: true })
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

  outputs.push(await generateSquareIcon(192, "icon-192.png"));
  outputs.push(await generateSquareIcon(512, "icon-512.png"));
  outputs.push(await generateSquareIcon(512, "icon-512-maskable.png"));

  // iOS recommended size for apple-touch-icon
  outputs.push(await generateSquareIcon(180, "apple-touch-icon.png"));

  // eslint-disable-next-line no-console
  console.log("Generated PWA icons:\n" + outputs.map((p) => "- " + p).join("\n"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
