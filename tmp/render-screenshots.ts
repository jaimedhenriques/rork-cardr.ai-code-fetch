import { chromium } from "playwright";
import { readdirSync, mkdirSync } from "fs";
import { resolve } from "path";

const srcDir = resolve("screenshots/iphone/en");
const outDir = resolve("screenshots/final/iphone");
mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith(".html")).sort();
const start = Number(process.argv[2] ?? 0);
const end = Number(process.argv[3] ?? files.length);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1284, height: 2778 },
  deviceScaleFactor: 1,
});

for (const f of files.slice(start, end)) {
  const out = `${outDir}/${f.replace(".html", ".png")}`;
  await page.goto(`file://${srcDir}/${f}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1284, height: 2778 } });
  console.log("rendered", out);
}

await browser.close();
