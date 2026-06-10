// One-off DOM probe: open the "New Project from Git Repository" dialog on
// Posit Cloud and dump enough information to figure out which container is
// actually the modal. Run with:
//   cd scripts/screenshots && node probe-modal.js
import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILE_DIR = path.resolve(__dirname, ".puppeteer-profile");
const POSIT_WORKSPACE_URL =
  "https://posit.cloud/spaces/784454/content/all?sort=name_asc";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
  userDataDir: PROFILE_DIR,
  args: ["--no-first-run", "--no-default-browser-check"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });
  await page.goto(POSIT_WORKSPACE_URL, { waitUntil: "load", timeout: 60000 });
  await sleep(1500);

  // Click "New Project" then "New Project from Git Repository".
  await page.evaluate(() => {
    const all = document.querySelectorAll(
      'button, [role="button"], a[role="button"]',
    );
    for (const b of all) {
      const t = (b.innerText || b.textContent || "").trim();
      if (t === "New Project") {
        b.click();
        return;
      }
    }
  });
  await sleep(500);
  await page.evaluate(() => {
    const all = document.querySelectorAll(
      'button, [role="button"], a[role="button"], li, div',
    );
    for (const b of all) {
      const t = (b.innerText || b.textContent || "").trim();
      if (t === "New Project from Git Repository") {
        b.click();
        return;
      }
    }
  });
  await sleep(1200);

  // Dump useful diagnostics.
  const diagnostics = await page.evaluate(() => {
    // 1. All visible inputs on the page.
    const inputs = Array.from(document.querySelectorAll("input")).map((i, idx) => {
      const r = i.getBoundingClientRect();
      return {
        idx,
        type: i.type,
        placeholder: i.placeholder || "",
        ariaLabel: i.getAttribute("aria-label") || "",
        name: i.name || "",
        id: i.id || "",
        role: i.getAttribute("role") || "",
        visible: i.offsetParent !== null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        // Walk ancestors and record the first one that looks like a modal.
        ancestorClasses: (() => {
          const out = [];
          let n = i.parentElement;
          let depth = 0;
          while (n && depth < 12) {
            out.push({ tag: n.tagName.toLowerCase(), cls: n.className && typeof n.className === 'string' ? n.className.slice(0, 80) : '', role: n.getAttribute && n.getAttribute('role') || '', id: n.id || '' });
            n = n.parentElement;
            depth++;
          }
          return out;
        })(),
      };
    });

    // 2. Find the header text node and report its ancestor chain.
    let headerChain = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if ((node.textContent || "").trim() === "New Project from Git Repository") {
        const chain = [];
        let n = node.parentElement;
        let depth = 0;
        while (n && depth < 15) {
          chain.push({
            tag: n.tagName.toLowerCase(),
            cls: (n.className && typeof n.className === 'string') ? n.className.slice(0, 100) : '',
            role: n.getAttribute('role') || '',
            id: n.id || '',
            inputCount: n.querySelectorAll('input').length,
            ariaModal: n.getAttribute('aria-modal') || '',
          });
          n = n.parentElement;
          depth++;
        }
        headerChain = chain;
        break;
      }
      node = walker.nextNode();
    }

    return { inputs, headerChain };
  });

  console.log("\n=== INPUTS ON PAGE ===");
  for (const i of diagnostics.inputs) {
    if (!i.visible) continue;
    console.log(
      `[${i.idx}] type=${i.type} placeholder="${i.placeholder}" aria-label="${i.ariaLabel}" id="${i.id}" rect=${JSON.stringify(i.rect)}`,
    );
    console.log(
      `       ancestors: ${i.ancestorClasses.map((a) => `${a.tag}${a.id ? "#" + a.id : ""}${a.cls ? "." + a.cls.split(/\s+/).slice(0, 2).join(".") : ""}${a.role ? "[" + a.role + "]" : ""}`).join(" > ")}`,
    );
  }

  console.log("\n=== HEADER ANCESTOR CHAIN ('New Project from Git Repository') ===");
  if (!diagnostics.headerChain) {
    console.log("  header text not found");
  } else {
    for (const a of diagnostics.headerChain) {
      console.log(
        `  ${a.tag}${a.id ? "#" + a.id : ""}${a.cls ? "." + a.cls.replace(/\s+/g, ".") : ""}${a.role ? "[role=" + a.role + "]" : ""}${a.ariaModal ? "[aria-modal=" + a.ariaModal + "]" : ""} (inputs inside: ${a.inputCount})`,
      );
    }
  }

  console.log("\nLeaving browser open for 5s so you can inspect, then closing.");
  await sleep(5000);
} finally {
  await browser.close();
}
