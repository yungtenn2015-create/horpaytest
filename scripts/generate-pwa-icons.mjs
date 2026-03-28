/**
 * PWA / home-screen icons: emerald frame + lighter rounded panel + large white house (vector SVG → PNG).
 * Keep shapes in sync with src/components/HorpayHouseMark.tsx (houseIconSvg).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdir, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "public", "icons");

/** Design in 512×512; scaled to each output size for sharp edges. */
function houseIconSvg(px) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#10b981"/>
  <rect x="28" y="28" width="456" height="456" rx="54" fill="#6ee7b7"/>
  <polygon points="256,64 64,268 448,268" fill="#ffffff"/>
  <rect x="88" y="268" width="336" height="208" rx="16" fill="#ffffff"/>
  <rect x="216" y="352" width="80" height="124" rx="14" fill="#10b981"/>
</svg>`;
}

async function writeHouseIcon(px, dest) {
  const buf = Buffer.from(houseIconSvg(px), "utf8");
  await sharp(buf, { density: 450 }).png().toFile(dest);
}

await mkdir(iconsDir, { recursive: true });

await writeHouseIcon(192, join(iconsDir, "icon-192.png"));
await writeHouseIcon(512, join(iconsDir, "icon-512.png"));
await writeHouseIcon(180, join(iconsDir, "apple-touch-icon.png"));
await writeHouseIcon(32, join(root, "src", "app", "icon.png"));

await copyFile(
  join(iconsDir, "apple-touch-icon.png"),
  join(root, "src", "app", "apple-icon.png")
);

/** อีเมล (Supabase template) — PNG ใช้ได้กับ Outlook มากกว่า SVG */
await writeHouseIcon(160, join(root, "public", "email-horpay-logo.png"));

console.log("Wrote PWA icons (house) under public/icons/ and src/app/icon.png, apple-icon.png + public/email-horpay-logo.png");
