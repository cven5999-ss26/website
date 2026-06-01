# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Quarto-based course website for CVEN 5999: Special Topics - Data Analytics for Development, a summer course at CU Boulder. The site includes course materials, lecture slides, module content, and project information.

**Current iteration**: SS26 (Summer 2026)

## Architecture

### Content Structure
- **Main pages**: Course overview (`index.qmd`), project details (`project/index.qmd`), schedule (`schedule.qmd`)
- **Module content**: Located in `modules/` directory (md-01.qmd through md-07.qmd)
- **Lecture slides**: Located in `slides/` directory with RevealJS format (.qmd files)
- **Data**: Course data and R scripts in `data/` directory
- **Images**: Organized by lecture in `slides/img/` with subdirectories

### Configuration
- **Main config**: `_quarto.yml` - Controls website structure, theme, sidebar navigation
- **Variables**: `_variables.yml` - Course-specific variables (dates, titles, GitHub org)
- **Theme**: `theme.scss` and `slides.scss` for styling
- **Output**: Builds to `docs/` directory for GitHub Pages deployment

### Key Technologies
- **Quarto**: Static site generator with R integration
- **RevealJS**: For presentation slides
- **R/tidyverse**: Data analysis and visualization in course content
- **GitHub Pages**: Hosting platform (output to `docs/`)

## Development Commands

### Building the Site
```bash
# Render the entire website
quarto render

# Render specific content
quarto render index.qmd
quarto render slides/lec-a-welcome.qmd
quarto render modules/md-01.qmd
```

### Preview During Development
```bash
# Start preview server (watches for changes)
quarto preview

# Preview specific slide deck
quarto preview slides/lec-a-welcome.qmd
```

### Publishing
```bash
# Publish to GitHub Pages (builds to docs/ directory)
quarto publish gh-pages
```

## Content Guidelines

### File Organization
- Module content follows naming convention: `md-XX.qmd` where XX is module number (01-07)
- Lecture slides follow: `lec-XX-topic.qmd` pattern (lecture numbers are independent of module numbers)
- Images organized in `slides/img/lec-XX/` subdirectories
- Data files in `data/` with R scripts for processing

### YAML Frontmatter Patterns
- Course pages use standard Quarto frontmatter with `title`, `editor: source`
- Slides use RevealJS format with custom theme, transitions, and branding
- Execution settings typically include `echo: false`, `warning: false` for clean output

### Content Integration
- Course data pulled from CSV files in `data/` directory using R code chunks
- Variables from `_variables.yml` referenced throughout content using Quarto syntax (e.g., `{{< var md-01.date >}}`)
- Cross-references between modules, slides, and project materials via relative paths

## R Environment
- Uses tidyverse packages for data manipulation and visualization
- Additional packages: countdown, gt, here, knitr for enhanced functionality
- Code execution with Quarto's freeze feature for reproducible builds


## Project Management with GitHub CLI

- List issues: `gh issue list`
- View issue details: `gh issue view 80` (e.g., for issue #80 "Rename geographies parameter")
- Create branch for issue: `gh issue develop 80`
- Checkout branch: `git checkout 80-rename-geographies-parameter-to-entities`
- Create pull request: `gh pr create --title "Rename geographies parameter to entities" --body "Implements #80"`
- List pull requests: `gh pr list`
- View pull request: `gh pr view PR_NUMBER`

## Companion homework repos

Homework repos live at `github.com/cven-dev/md-XX` and are cloned into Posit Cloud. Mapping:

| Module | Repo | Lecture |
|--------|------|---------|
| 2 | `md-02` | lec-a |
| 4 | `md-04` | lec-b |
| 5 | `md-05` | lec-c |
| 6 | `md-06` | lec-d |
| 7 | `md-07` | lec-e |
| 7 | `md-07-writing` | (scholarly writing companion) |

Lecture qmds use letters (`lec-a` … `lec-e`) so they're not confused with module numbering. `learning-XX.qmd` files inside each repo match the module number. `hw-*.qmd` and `live-*.qmd` filenames remain topic-named.

## Puppeteer screenshot script

`scripts/screenshots/take-screenshots.js` regenerates the 9 screenshots used in `assignments/md-02/am-02-1-github-clone.qmd`. Run with `cd scripts/screenshots && node take-screenshots.js` (add `LOGIN=true` only on first run / after deleting `.puppeteer-profile/`). The persistent profile at `scripts/screenshots/.puppeteer-profile/` holds the signed-in GitHub + Posit Cloud sessions.

All 9 steps work. Step 8 finds the "New Project from Git Repository" dialog by anchoring on the native `<dialog class="modalDialog">` element (Posit Cloud renders the modal into `div#modalRoot > body`, not into the React app tree). The URL input is `input#repoURL` inside that dialog.

**Notes:**
- Red-box highlights only, no text labels (user preference).
- `findFirstByText` uses exact match (not `startsWith`) to avoid "New Project" grabbing "New Project from Git Repository".
- `page.goto` uses `waitUntil: "load"` (not `networkidle2`) because GitHub keeps long-lived background requests open; `networkidle2` was timing out.
- Posit Cloud's workspace list is client-rendered. `waitForPositWorkspaceReady` polls for the "New Project" button before clicking on steps 6–9.
- **Step 9 creates an actual project** `md-02-rainbow-train` in the Posit workspace. Delete the existing project from Posit before re-running, otherwise step 9 captures the post-create workspace list instead of the deploying screen.
