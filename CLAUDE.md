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
quarto render slides/lec-01-welcome.qmd
quarto render modules/md-01.qmd
```

### Preview During Development
```bash
# Start preview server (watches for changes)
quarto preview

# Preview specific slide deck
quarto preview slides/lec-01-welcome.qmd
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

## Pending Tasks

### Posit Cloud Homework File Renaming
The website was restructured from "weeks" to "modules" in SS26. The homework and learning reflection files on Posit Cloud need to be renamed to match the new module numbering:

**Module to lecture/homework mapping:**
| Module | Content | Lecture | HW files to rename |
|--------|---------|---------|-------------------|
| 1 | Get ready | - | (no changes needed) |
| 2 | Welcome & DS Lifecycle | lec-01 | hw-02, learning-02 |
| 3 | Case Study | - | (new module, no lecture) |
| 4 | EDA & Spreadsheets | lec-02 | hw-03→hw-04, learning-03→learning-04 |
| 5 | Transformation | lec-03 | hw-04→hw-05, learning-04→learning-05 |
| 6 | Tidy data | lec-04 | hw-05→hw-06, learning-05→learning-06 |
| 7 | Joining & Quarto | lec-05 | hw-06→hw-07, learning-06→learning-07 |
| 8 | Capstone submission | - | (project only) |

**Files affected on Posit Cloud:**
- Project folders need renaming (e.g., `wk-03` → `md-04`)
- Homework .qmd files within each project
- Learning reflection .qmd files within each project

This renaming should be done in a session with access to the Posit Cloud development repositories.
