// Renders the PWA icons from public/favicon.svg. Run with: npm run icons
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8");
mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });

const render = (source, size, file) => {
  const png = new Resvg(source, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), png);
  console.log(`icons/${file}`);
};

render(svg, 192, "icon-192.png");
writeFileSync(new URL("../extension/icon-128.png", import.meta.url), new Resvg(svg, { fitTo: { mode: "width", value: 128 } }).render().asPng());
console.log("extension/icon-128.png");
render(svg, 512, "icon-512.png");
// Maskable: full-bleed background with the glyph inside the safe zone.
const inner = svg.replace(/<svg[^>]*>/, "").replace("</svg>", "").replace(/<rect[^>]*\/>/, "");
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#F4B8CE"/><g transform="translate(12.8 12.8) scale(.6)">${inner}</g></svg>`;
render(maskable, 512, "icon-maskable-512.png");
