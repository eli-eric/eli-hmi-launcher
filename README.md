# ELI HMIs Launcher

Electron launcher for control-system HMIs. The launcher reads a YAML configuration, presents the configured GUIs in tile or tree form, and opens web pages or local executables on the host machine.

## Implemented launcher behavior

- YAML-driven configuration in `config/launcher.yaml`
- Hierarchical navigation groups
- Tile and compact tree views
- Search restricted to launchable `name` and `note`
- Filters restricted to `technology` and `section`
- Transactional config reload: an invalid edit reports an error while the last valid configuration remains active
- Silent launch behavior: no progress/status bar; successful launches are silent and failures show an actionable error
- Web targets limited to `http://` and `https://`
- Executable targets resolved by full path or machine `PATH`, with checks for missing files, permissions, working directories, spawn errors, and immediate non-zero exits
- Pico CSS as the standard UI component/style foundation, with application-specific CSS limited to layout and branding
- Automated tests and GitHub Actions CI

## Run locally

```sh
npm install
npm start
```

To run all submission checks:

```sh
npm run check
npm audit
```

`npm run check` performs TypeScript checking, the automated test suite, and a production Electron/Vite build.

## Use a custom YAML file

Set `ELI_LAUNCHER_CONFIG` to an absolute path:

```sh
ELI_LAUNCHER_CONFIG=/absolute/path/to/launcher.yaml npm start
```

On Windows PowerShell:

```powershell
$env:ELI_LAUNCHER_CONFIG = "C:\path\to\launcher.yaml"
npm start
```

## YAML configuration

The complete field reference is in [`docs/launcher-config.md`](docs/launcher-config.md). A commented L4 fill-in template is in [`config/l4.template.yaml`](config/l4.template.yaml).

```yaml
appName: ELI L4 Launcher
menu:
  - label: L4
    launchables:
      - id: l4-vacuum-overview
        name: Vacuum Overview       # searched
        note: Main operator panel   # searched
        technology: Web             # filterable
        section: Vacuum             # filterable
        type: web
        url: "https://example.test/vacuum"
```

`name` is required. Legacy launchable fields `label` and `description` remain readable for migration, but the launcher reports a warning instructing users to rename them to `name` and `note`.

## Offline Electron documentation

The repository contains a Markdown mirror of Electron documentation under `docs/electron/`. Refresh it with:

```sh
npm run sync:electron-docs
```
