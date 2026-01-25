/* Generates full-bleed PWA icons from the logo.
  Input:  public/logo-new2.png
   Output: public/icons/*.png
*/

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const inputPath = path.join(root, "public", "logo-new2.png");
const outputDir = path.join(root, "public", "icons");

const BG = "#165CF0";

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

  await sharp(inputPath)
    .ensureAlpha()
    .resize(size, size, {
      fit: "cover",
      withoutEnlargement: true,
    })
    .flatten({ background: BG })
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
