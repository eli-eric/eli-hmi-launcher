# Launcher YAML configuration

This is the field reference for users entering L4 and other control-system GUIs. Start from [`config/l4.template.yaml`](../config/l4.template.yaml) rather than writing a file from zero.

## 1. Select the configuration file

The default file is `config/launcher.yaml`. Set `ELI_LAUNCHER_CONFIG` to use another absolute path:

```sh
ELI_LAUNCHER_CONFIG=/absolute/path/to/l4.yaml npm start
```

Windows PowerShell:

```powershell
$env:ELI_LAUNCHER_CONFIG = "C:\path\to\l4.yaml"
npm start
```

After editing the file, press **Reload config**. Reloading is transactional: the launcher parses and validates the replacement first. If the replacement cannot be read or contains invalid YAML syntax, the last successfully loaded configuration remains visible and launchable.

## 2. Overall structure

```yaml
appName: ELI L4 Launcher
menu:
  - label: L4
    children:
      - label: Vacuum
        launchables:
          - id: l4-vacuum-overview
            name: Vacuum Overview
            note: Overall vacuum state of the L4 beamline
            technology: Web
            section: Vacuum
            type: web
            url: "https://vacuum.example/overview"
```

`menu` is a list of groups. A group requires `label` and can contain `children`, `launchables`, or both. Groups organize navigation; search and filter data belongs to each launchable.

## 3. Launchable fields

| Field | Required | Behavior |
| --- | --- | --- |
| `id` | yes | Stable unique identifier across the entire file. Use kebab-case, such as `l4-vacuum-overview`. Duplicate entries are skipped. |
| `name` | yes | Operator-facing title. Search matches this field. |
| `note` | no | Short operator-facing description. Search matches this field. |
| `technology` | no | Exact Technology filter value, such as `CS Studio`, `WinCC OA`, `LabVIEW`, or `Web`. |
| `section` | no | Exact Section filter value, such as `Vacuum`, `Motion`, `Timing`, or `Diagnostics`. |
| `type` | yes | Exactly `web` or `executable`. |

Search is case-insensitive and checks **only** `name` and `note`. It does not search `id`, `technology`, `section`, URLs, commands, arguments, or group names.

The only filters are **Technology** and **Section**. Their choices are generated from the distinct `technology` and `section` values in the file. Spelling and capitalization should therefore be standardized before collecting dozens of entries.

## 4. Web launchables

```yaml
- id: l4-vacuum-overview
  name: Vacuum Overview
  note: Overall vacuum state of the L4 beamline
  technology: Web
  section: Vacuum
  type: web
  url: "https://vacuum.example/overview"
```

`url` is required. Only absolute `http://` and `https://` URLs are accepted. Invalid URLs are reported during configuration loading and the affected entry is skipped.

## 5. Executable launchables

```yaml
- id: l4-motion-main
  name: Motion Main Panel
  note: Motorized stages and axes control
  technology: CS Studio
  section: Motion
  type: executable
  command: "C:/Program Files/CSStudio/css.exe"
  args: ["--workspace", "L4-motion"]
  cwd: "C:/CSStudio/workspaces"
```

| Field | Required | Behavior |
| --- | --- | --- |
| `command` | yes | Full executable path, or a bare command available on the machine `PATH`. Full paths are recommended. |
| `args` | no | YAML list containing one scalar argument per item. Strings, numbers, and booleans are accepted and converted to command-line strings. A single combined string is invalid. |
| `cwd` | no | Existing directory used as the process working directory. |

Windows paths can use forward slashes to avoid YAML backslash escaping. `.bat` and `.cmd` commands are launched through `cmd.exe` with explicit argument quoting.

## 6. Validation and launch errors

The file is validated entry by entry. Invalid entries are skipped while valid entries remain available. The warning banner identifies the YAML location, for example `menu[0].children[1].launchables[2]`.

Reported configuration problems include:

- missing group `label`
- missing or duplicate launchable `id`
- missing launchable `name`
- unsupported or missing `type`
- missing/invalid web `url`
- missing executable `command`
- non-list `args` or structured values inside `args`
- non-string optional fields

Reported launch failures include:

- executable path does not exist
- command is not present on `PATH`
- file exists but is not executable
- working directory is missing or is not a directory
- process spawn failure
- process exits immediately with a non-zero code or signal
- browser/operating-system rejection of a web target

There is no launch progress bar. The click is silent when successful; a failure is shown in the error banner.

## 7. Migration from older files

Old launchable fields are accepted only as migration aliases:

- `label` → `name`
- `description` → `note`

An entry using either alias remains usable, but the launcher displays a warning. New and updated files should use only `name` and `note`. An entry with neither `name` nor legacy `label` is invalid and skipped.

## 8. L4 data-entry checklist

1. Copy `config/l4.template.yaml` to the intended machine-specific path.
2. Agree on controlled `technology` and `section` values before collecting entries.
3. Give every GUI a unique `id` and required `name`.
4. Write `note` using words operators are likely to search.
5. Use one argument per `args` list item.
6. Reload the file and resolve every warning.
7. Test each GUI on the target machine, because local paths, permissions, and `PATH` vary by host.
