/* Generates favicon assets from the transparent logo.
  Input:  public/logo-new2.png
   Output: public/favicon.ico, public/favicon-16.png, public/favicon-32.png, public/favicon-48.png
*/

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const root = path.join(__dirname, "..");
const inputPath = path.join(root, "public", "logo-new2.png");
const outputDir = path.join(root, "public");

const LOGO_SCALE = 0.9; // keep some padding for small sizes

async function ensureInput() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing input logo: ${ inputPath }`);
  }
}

async function generateFaviconPng(size) {
  const inner = Math.max(1, Math.round(size * LOGO_SCALE));

  const logo = await sharp(inputPath)
    .ensureAlpha()
    .resize(inner, inner, {
      fit: "contain",
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const outPath = path.join(outputDir, `favicon-${ size }.png`);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);

  return outPath;
}

async function main() {
  await ensureInput();

  const sizes = [16, 32, 48];
  const pngPaths = [];

  for (const size of sizes) {
    pngPaths.push(await generateFaviconPng(size));
  }

  const icoBuf = await pngToIco(pngPaths);
  const icoPath = path.join(outputDir, "favicon.ico");
  fs.writeFileSync(icoPath, icoBuf);

  // eslint-disable-next-line no-console
  console.log(
    "Generated favicon assets:\n" +
    [icoPath, ...pngPaths].map((p) => "- " + p).join("\n")
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
