import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(
  __dirname,
  "../../assignments/md-02/images/github-clone",
);

const HEADLESS = process.env.HEADLESS === "true";
const LOGIN = process.env.LOGIN === "true";
const PROFILE_DIR = path.resolve(__dirname, ".puppeteer-profile");
const DEBUG_DIR = path.resolve(__dirname, "debug");

const VIEWPORT = { width: 1400, height: 900, deviceScaleFactor: 2 };

const STUDENT_REPO_URL = "https://github.com/cven5999-ss26/md-02-rainbow-train";
const STUDENT_REPO_HTTPS = "https://github.com/cven5999-ss26/md-02-rainbow-train.git";
const POSIT_WORKSPACE_URL = "https://posit.cloud/spaces/784454/content/all?sort=name_asc";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    process.stdout.write(`\n${message}\nPress Enter to continue... `);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

async function findFirst(page, label, candidates) {
  for (const sel of candidates) {
    const el = await page.$(sel);
    if (el) {
      console.log(`   ${label} selector: ${sel}`);
      return { sel, el };
    }
  }
  throw new Error(
    `${label}: none of these selectors matched: ${candidates.join(" | ")}. Inspect the live page and add a working selector.`,
  );
}

// Locate the modal dialog container for "New Project from Git Repository".
// Strategy: prefer explicit role="dialog" / aria-modal / common modal class
// names. Fall back to walking up from the header text only if no modal markup
// is found. The dialog must NOT be the document body (which would catch the
// page-wide workspace search input).
async function findGitDialog(page) {
  const debug = await page.evaluate(() => {
    const sels = [
      'dialog[open]', 'dialog.modalDialog', 'dialog',
      '[role="dialog"]', '[aria-modal="true"]', '.modal.in',
      '.modal[style*="display: block"]', '.modal-dialog',
      '.rs-modal', '.posit-modal', '.ReactModal__Content', '.MuiDialog-paper',
    ];
    const hits = [];
    for (const s of sels) {
      const matched = document.querySelectorAll(s).length;
      if (matched > 0) hits.push(`${s} (${matched})`);
    }
    return hits;
  });
  if (debug.length > 0) {
    console.log("   modal candidates on page:", debug.join(", "));
  } else {
    console.log("   no standard modal markup found; will use header walk-up");
  }
  const handle = await page.evaluateHandle(() => {
    const modalSelectors = [
      'dialog[open]',
      'dialog.modalDialog',
      'dialog',
      '[role="dialog"]',
      '[aria-modal="true"]',
      '.modal.in',
      '.modal[style*="display: block"]',
      '.modal-dialog',
      '.rs-modal',
      '.posit-modal',
      '.ReactModal__Content',
      '.MuiDialog-paper',
    ];
    for (const sel of modalSelectors) {
      const candidates = document.querySelectorAll(sel);
      for (const c of candidates) {
        const text = (c.innerText || c.textContent || "").trim();
        if (text.includes("New Project from Git Repository") && c.querySelector("input")) {
          return c;
        }
      }
    }
    // Fallback: walk up from the header text, but stop short of <body>.
    let header = null;
    for (const n of document.querySelectorAll("*")) {
      const text = (n.innerText || n.textContent || "").trim();
      if (text === "New Project from Git Repository") { header = n; break; }
    }
    if (!header) return null;
    let node = header.parentElement;
    while (node && node !== document.body && node.parentElement !== document.body) {
      if (node.querySelector("input")) return node;
      node = node.parentElement;
    }
    return null;
  });
  const el = handle.asElement();
  if (!el) return null;
  return el;
}

// Find the URL text input inside the git dialog. The URL field is the *last*
// visible <input> in the dialog (the first input is the project-type combobox).
async function findDialogUrlInput(page) {
  const dialog = await findGitDialog(page);
  if (!dialog) {
    throw new Error("Dialog URL input: git dialog not found (header text missing).");
  }
  const handle = await page.evaluateHandle((dlg) => {
    // Posit Cloud's git URL field is id="repoURL" — prefer it directly.
    const byId = dlg.querySelector("#repoURL");
    if (byId) return byId;
    const inputs = Array.from(dlg.querySelectorAll("input")).filter((i) => {
      if (i.type === "hidden") return false;
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (inputs.length === 0) return null;
    // Pick the last visible non-combobox input. Posit's project-type combobox
    // is usually role="combobox" or has aria-haspopup; the URL field doesn't.
    for (let i = inputs.length - 1; i >= 0; i--) {
      const inp = inputs[i];
      if (inp.getAttribute("role") === "combobox") continue;
      if (inp.getAttribute("aria-haspopup")) continue;
      return inp;
    }
    return inputs[inputs.length - 1];
  }, dialog);
  const el = handle.asElement();
  if (!el) {
    throw new Error("Dialog URL input: no usable input found inside the dialog.");
  }
  // Sanity check: log the input's bounding rect + placeholder so we can spot
  // when we grabbed the wrong field.
  const info = await page.evaluate((inp) => ({
    placeholder: inp.placeholder || "",
    ariaLabel: inp.getAttribute("aria-label") || "",
    rect: inp.getBoundingClientRect().toJSON ? inp.getBoundingClientRect().toJSON() : (() => {
      const r = inp.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })(),
    parentDialogText: (inp.closest('dialog, [role="dialog"], .modal-dialog, .rs-modal, .ReactModal__Content, .MuiDialog-paper') || {}).innerText?.slice(0, 80) || "(no modal ancestor)",
  }), el);
  console.log("   Dialog URL input details:", JSON.stringify(info));
  return el;
}

// Find the OK / submit button *inside* the git dialog (not Posit's other OK
// buttons elsewhere on the page).
async function findDialogOkButton(page) {
  const dialog = await findGitDialog(page);
  if (!dialog) {
    throw new Error("Dialog OK button: git dialog not found.");
  }
  const handle = await page.evaluateHandle((dlg) => {
    const buttons = dlg.querySelectorAll('button, [role="button"]');
    for (const b of buttons) {
      const text = (b.innerText || b.textContent || "").trim();
      if (text === "OK" || text === "Create" || text === "Submit") return b;
    }
    return null;
  }, dialog);
  const el = handle.asElement();
  if (!el) {
    throw new Error("Dialog OK button: no OK button found inside the dialog.");
  }
  console.log("   Dialog OK button: matched inside dialog");
  return el;
}

// Find the green "Code" button on a GitHub repository page. Distinguished from
// the "Code" navigation tab by being a button (not an anchor), commonly with
// data-testid="get-repo-button" or wrapped in a <details> that holds the clone
// dropdown.
async function findGitHubCodeButton(page) {
  const handle = await page.evaluateHandle(() => {
    // Preferred: stable test id.
    const byTestId = document.querySelector('[data-testid="get-repo-button"]');
    if (byTestId) return byTestId;
    // Fallback: a real <button> with text "Code", excluding nav links.
    const buttons = document.querySelectorAll('button, summary[role="button"], [role="button"]');
    for (const b of buttons) {
      const text = (b.innerText || b.textContent || "").trim();
      if (text === "Code" || text.startsWith("Code ")) {
        // Skip if this button is inside the file-tree pagehead nav.
        if (b.closest('nav[aria-label*="Repository" i], .UnderlineNav')) continue;
        return b;
      }
    }
    return null;
  });
  const el = handle.asElement();
  if (!el) {
    throw new Error("GitHub Code button: could not locate the green Code dropdown trigger.");
  }
  console.log("   GitHub Code button: matched");
  return el;
}

// Inject red rectangular highlight overlays around the bounding boxes of
// the given targets. Each target is { kind: "selector" | "text" | "labelInput"
// | "githubCodeButton", value?: string, note?: string }. The overlays remain
// in the page until reload, so the subsequent screenshot will include them.
// `note` is accepted but no longer rendered — user prefers boxes only.
async function highlightTargets(page, targets) {
  if (!targets || targets.length === 0) return;
  await page.evaluate((targets) => {
    // Resolve each target to its DOM element.
    function resolveTarget(t) {
      if (t.kind === "selector") {
        return document.querySelector(t.value);
      }
      if (t.kind === "text") {
        // Exact-match only — prevents "New Project" highlight from accidentally
        // landing on "New Project from Git Repository" (which also starts with it).
        const candidates = document.querySelectorAll('button, [role="button"], a, label, span, div, li');
        for (const el of candidates) {
          const text = (el.innerText || el.textContent || "").trim();
          if (text === t.value) return el;
        }
      }
      if (t.kind === "labelInput") {
        const labels = Array.from(document.querySelectorAll("label, div, span"));
        const labelEl = labels.find(
          (n) => (n.innerText || n.textContent || "").trim().startsWith(t.value),
        );
        if (!labelEl) return null;
        let node = labelEl;
        for (let i = 0; i < 6 && node; i++) {
          const input = node.querySelector && node.querySelector('input, textarea');
          if (input) return input;
          node = node.parentElement;
        }
      }
      if (t.kind === "githubCodeButton") {
        const byTestId = document.querySelector('[data-testid="get-repo-button"]');
        if (byTestId) return byTestId;
        const buttons = document.querySelectorAll('button, summary[role="button"], [role="button"]');
        for (const b of buttons) {
          const text = (b.innerText || b.textContent || "").trim();
          if (text === "Code" || text.startsWith("Code ")) {
            if (b.closest('nav[aria-label*="Repository" i], .UnderlineNav')) continue;
            return b;
          }
        }
      }
      if (t.kind === "dialogUrlInput" || t.kind === "dialogOkButton") {
        // Find dialog via modal markup first, then fall back to header walk-up.
        const modalSelectors = [
          '[role="dialog"]', '[aria-modal="true"]', '.modal.in',
          '.modal[style*="display: block"]', '.modal-dialog',
          '.rs-modal', '.posit-modal', '.ReactModal__Content', '.MuiDialog-paper',
        ];
        let dlg = null;
        for (const sel of modalSelectors) {
          for (const c of document.querySelectorAll(sel)) {
            const text = (c.innerText || c.textContent || "").trim();
            if (text.includes("New Project from Git Repository") && c.querySelector("input")) {
              dlg = c; break;
            }
          }
          if (dlg) break;
        }
        if (!dlg) {
          let header = null;
          for (const n of document.querySelectorAll("*")) {
            const text = (n.innerText || n.textContent || "").trim();
            if (text === "New Project from Git Repository") { header = n; break; }
          }
          if (!header) return null;
          let node = header.parentElement;
          while (node && node !== document.body && node.parentElement !== document.body) {
            if (node.querySelector("input")) { dlg = node; break; }
            node = node.parentElement;
          }
        }
        if (!dlg) return null;
        if (t.kind === "dialogUrlInput") {
          const inputs = Array.from(dlg.querySelectorAll("input")).filter(
            (i) => i.offsetParent !== null && i.type !== "hidden",
          );
          for (let i = inputs.length - 1; i >= 0; i--) {
            const inp = inputs[i];
            if (inp.getAttribute("role") === "combobox") continue;
            if (inp.getAttribute("aria-haspopup")) continue;
            return inp;
          }
          return inputs[inputs.length - 1] || null;
        }
        if (t.kind === "dialogOkButton") {
          for (const b of dlg.querySelectorAll('button, [role="button"]')) {
            const text = (b.innerText || b.textContent || "").trim();
            if (text === "OK" || text === "Create" || text === "Submit") return b;
          }
        }
      }
      return null;
    }

    targets.forEach((t, i) => {
      const el = resolveTarget(t);
      if (!el) {
        console.warn("highlight: no element for", t);
        return;
      }
      const rect = el.getBoundingClientRect();
      const pad = 6;
      const box = document.createElement("div");
      Object.assign(box.style, {
        position: "fixed",
        left: `${rect.left - pad}px`,
        top: `${rect.top - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
        border: "4px solid #e11d48",
        borderRadius: "8px",
        boxShadow: "0 0 0 2px rgba(225, 29, 72, 0.25)",
        zIndex: "2147483646",
        pointerEvents: "none",
      });
      document.body.appendChild(box);

      // Text labels intentionally omitted — user prefers boxes only.
    });
  }, targets);
  // Tiny pause so the overlays render before the screenshot.
  await sleep(150);
}

// Posit Cloud's workspace UI is client-rendered. Wait for the "New Project"
// button to actually be in the DOM before trying to click it.
async function waitForPositWorkspaceReady(page) {
  await page.waitForFunction(
    () => {
      for (const el of document.querySelectorAll('button, [role="button"], a')) {
        if ((el.innerText || "").trim().startsWith("New Project")) return true;
      }
      return false;
    },
    { timeout: 20000 },
  );
}

async function findFirstByText(page, label, role, texts) {
  for (const text of texts) {
    const handle = await page.evaluateHandle(
      (r, t) => {
        const tags = r === "button" ? ["button", '[role="button"]', "a"] : ["*"];
        for (const tag of tags) {
          const nodes = document.querySelectorAll(tag);
          for (const n of nodes) {
            const label = (n.innerText || n.textContent || "").trim();
            if (label === t) return n;
          }
        }
        return null;
      },
      role,
      text,
    );
    const el = handle.asElement();
    if (el) {
      console.log(`   ${label} text match: "${text}"`);
      return el;
    }
  }
  throw new Error(`${label}: no element matched any of: ${texts.join(" | ")}`);
}

// Steps captured logged-out (student perspective).
const incognitoSteps = [
  {
    name: "Step 1: GitHub homepage (logged out)",
    file: "screenshot-github-homepage.png",
    url: "https://github.com",
  },
];

// Steps captured in the persistent profile (signed in to GitHub + Posit Cloud).
const profileSteps = [
  {
    name: "Step 2: cven5999-ss26 organization page",
    file: "screenshot-github-org-search.png",
    url: "https://github.com/cven5999-ss26",
  },
  {
    name: "Step 3: org page filtered to md-02",
    file: "screenshot-github-repo-list.png",
    url: "https://github.com/cven5999-ss26",
    action: async (page) => {
      const { sel } = await findFirst(page, "Step 3 search input", [
        'input#org-repositories\\.repository-search-input',
        'input[placeholder="Find a repository..."]',
        'input[placeholder*="Find a repository"]',
        'input[aria-label*="Find a repository" i]',
      ]);
      await page.click(sel);
      await page.type(sel, "md-02", { delay: 60 });
      await sleep(1500);
    },
    highlight: [
      { kind: "text", value: "md-02-rainbow-train", note: "click your repo" },
    ],
  },
  {
    name: "Step 4: green Code button (dropdown open)",
    file: "screenshot-github-code-button.png",
    url: STUDENT_REPO_URL,
    action: async (page) => {
      const codeBtn = await findGitHubCodeButton(page);
      await codeBtn.click();
      // Wait for the dropdown / clone panel to render.
      await page.waitForSelector(
        'input[value*="github.com"], input[aria-label*="Clone" i], [role="dialog"]',
        { timeout: 10000 },
      );
      await sleep(500);
    },
    highlight: [
      { kind: "githubCodeButton" },
    ],
  },
  {
    name: "Step 5: HTTPS URL with clipboard icon",
    file: "screenshot-github-https-url.png",
    url: STUDENT_REPO_URL,
    action: async (page) => {
      const codeBtn = await findGitHubCodeButton(page);
      await codeBtn.click();
      await page.waitForSelector(
        'input[value*="github.com"], input[aria-label*="Clone" i]',
        { timeout: 10000 },
      );
      // Make sure the HTTPS tab is active, not SSH or GitHub CLI.
      try {
        const httpsTab = await findFirstByText(page, "HTTPS tab", "button", ["HTTPS"]);
        await httpsTab.click();
      } catch {
        // Already on HTTPS — fine.
      }
      await sleep(500);
    },
    highlight: [
      { kind: "selector", value: 'input[value*="github.com"]', note: "copy this URL" },
    ],
  },
  {
    name: "Step 6: Posit Cloud workspace",
    file: "screenshot-posit-cloud-workspace.png",
    url: POSIT_WORKSPACE_URL,
    action: async (page) => {
      await waitForPositWorkspaceReady(page);
      await sleep(800);
    },
    highlight: [
      { kind: "text", value: "Content" },
    ],
  },
  {
    name: "Step 7: New Project dropdown",
    file: "screenshot-posit-cloud-new-project.png",
    url: POSIT_WORKSPACE_URL,
    action: async (page) => {
      await waitForPositWorkspaceReady(page);
      const newProj = await findFirstByText(page, "New Project button", "button", [
        "New Project",
      ]);
      await newProj.click();
      await sleep(800);
    },
    highlight: [
      { kind: "text", value: "New Project" },
      { kind: "text", value: "New Project from Git Repository" },
    ],
  },
  {
    name: "Step 8: New Project from Git Repository dialog (URL pasted)",
    file: "screenshot-posit-cloud-git-url.png",
    url: POSIT_WORKSPACE_URL,
    action: async (page) => {
      await waitForPositWorkspaceReady(page);
      const newProj = await findFirstByText(page, "New Project button", "button", [
        "New Project",
      ]);
      await newProj.click();
      await sleep(500);
      const gitItem = await findFirstByText(page, "Git option", "button", [
        "New Project from Git Repository",
        "New Project from Git",
      ]);
      await gitItem.click();
      // Wait for the <dialog> to actually mount before searching for inputs.
      await page.waitForSelector("dialog.modalDialog, dialog[open]", { timeout: 5000 });
      await sleep(300);
      const urlInput = await findDialogUrlInput(page);
      await urlInput.click({ clickCount: 3 });
      await urlInput.type(STUDENT_REPO_HTTPS, { delay: 30 });
      // Verify the URL actually landed in this input.
      const typedValue = await page.evaluate((el) => el.value, urlInput);
      if (!typedValue.includes("github.com")) {
        throw new Error(
          `Step 8: URL did not land in the dialog input (input value: "${typedValue}"). Selector misfired.`,
        );
      }
      await sleep(800);
    },
    highlight: [
      { kind: "dialogUrlInput" },
      { kind: "dialogOkButton" },
    ],
  },
  {
    name: "Step 9: Posit deploying screen",
    file: "screenshot-posit-cloud-deploying.png",
    url: POSIT_WORKSPACE_URL,
    // Re-uses the state from Step 8 ideally, but goto() above means we redo it.
    // Keeping each step self-contained for now.
    action: async (page) => {
      await waitForPositWorkspaceReady(page);
      const newProj = await findFirstByText(page, "New Project button", "button", [
        "New Project",
      ]);
      await newProj.click();
      await sleep(500);
      const gitItem = await findFirstByText(page, "Git option", "button", [
        "New Project from Git Repository",
        "New Project from Git",
      ]);
      await gitItem.click();
      await page.waitForSelector("dialog.modalDialog, dialog[open]", { timeout: 5000 });
      await sleep(300);
      const urlInput = await findDialogUrlInput(page);
      await urlInput.click({ clickCount: 3 });
      await urlInput.type(STUDENT_REPO_HTTPS, { delay: 30 });
      const typedValue = await page.evaluate((el) => el.value, urlInput);
      if (!typedValue.includes("github.com")) {
        throw new Error(
          `Step 9: URL did not land in the dialog input (input value: "${typedValue}"). Aborting before OK click.`,
        );
      }
      await sleep(500);
      const okBtn = await findDialogOkButton(page);
      await okBtn.click();
      // Catch the deploying/loading state before it finishes.
      await sleep(1500);
    },
  },
];

async function captureSteps(browser, steps) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  try {
    for (const step of steps) {
      const outPath = path.join(OUTPUT_DIR, step.file);
      console.log(`-> ${step.name}`);
      console.log(`   ${step.url}`);
      try {
        // Use 'load' instead of 'networkidle2' — GitHub keeps long-lived
        // background requests open that prevent networkidle from ever firing.
        await page.goto(step.url, { waitUntil: "load", timeout: 60000 });
        // Small settle delay so the visible UI finishes painting.
        await sleep(800);
        if (step.action) {
          await step.action(page);
        }
        if (step.highlight) {
          await highlightTargets(page, step.highlight);
        }
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`   saved: ${outPath}`);
      } catch (err) {
        console.error(`   FAILED: ${err.message}`);
        // Save whatever the page currently shows for debugging.
        const debugPath = path.join(
          DEBUG_DIR,
          path.basename(outPath).replace(/\.png$/, ".error.png"),
        );
        try {
          mkdirSync(DEBUG_DIR, { recursive: true });
          await page.screenshot({ path: debugPath, fullPage: false });
          console.error(`   debug screenshot: ${debugPath}`);
        } catch {}
      }
    }
  } finally {
    await page.close();
  }
}

async function run() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (incognitoSteps.length > 0) {
    console.log("\n=== Incognito pass (logged-out browser) ===");
    const tmpProfile = await mkdtemp(path.join(os.tmpdir(), "puppeteer-incognito-"));
    const incBrowser = await puppeteer.launch({
      headless: HEADLESS,
      userDataDir: tmpProfile,
      defaultViewport: VIEWPORT,
    });
    try {
      await captureSteps(incBrowser, incognitoSteps);
    } finally {
      await incBrowser.close();
    }
  }

  if (profileSteps.length > 0) {
    console.log("\n=== Authenticated pass (persistent profile) ===");
    const browser = await puppeteer.launch({
      headless: HEADLESS,
      userDataDir: PROFILE_DIR,
      defaultViewport: VIEWPORT,
    });
    try {
      if (LOGIN) {
        const loginPage = await browser.newPage();
        await loginPage.setViewport(VIEWPORT);
        await loginPage.goto("https://posit.cloud/", { waitUntil: "networkidle2" });
        await waitForEnter(
          "Sign into Posit Cloud (and GitHub if needed) in the open window. Open as many tabs as you like. Profile: " +
            PROFILE_DIR,
        );
        await loginPage.close();
      }
      await captureSteps(browser, profileSteps);
    } finally {
      await browser.close();
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
