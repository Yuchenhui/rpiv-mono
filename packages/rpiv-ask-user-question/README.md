# @juicesharp/rpiv-ask-user-question

[![npm version](https://img.shields.io/npm/v/@juicesharp/rpiv-ask-user-question.svg)](https://www.npmjs.com/package/@juicesharp/rpiv-ask-user-question)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<div align="center">
  <a href="https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question">
    <img src="https://raw.githubusercontent.com/juicesharp/rpiv-mono/main/packages/rpiv-ask-user-question/docs/cover.png" alt="rpiv-ask-user-question cover: a tabbed terminal questionnaire asking Which real development task are we planning right now?, with numbered options — Bug fix, New feature, Refactor — each under a one-line description, and a footer of key hints" width="50%">
  </a>
</div>

Let the model ask you instead of guessing. This extension gives [Pi Agent](https://github.com/badlogic/pi-mono) one tool — `ask_user_question` — that opens a terminal dialog of up to four questions with written-out options, and hands your choices back as structured data. Install it if you would rather spend fifteen seconds picking than an hour undoing a wrong assumption.

## Install

```sh
pi install npm:@juicesharp/rpiv-ask-user-question
```

Restart your Pi session.

## Yuchenhui fork release policy

The Windows-only pinned fork is distributed as a self-contained GitHub Release
asset, **not** an npm publication or a Git install of this monorepo (Pi's Git
installer does not select a package subdirectory). Upstream attribution, MIT
licenses and the `@juicesharp` namespace are retained. The original baseline is
`5ee7845672f491b331e9b551a77a4a0fc9f79d89`; source/workspace manifests remain
`2.12.0` to preserve sibling peer compatibility. `2.12.0-yuchenhui.1` is an
**artifact-only overlay**, not the version of the source package.

From a committed checkout, with Node.js 22+, npm, Git and `tar` on PATH:

```sh
node scripts/pack-ask-user-question.mjs --source <recipe-and-documentation-commit-SHA> --version 2.12.0-yuchenhui.1 --out <absolute-directory-outside-checkout>
```

The recipe resolves the ref to its actual committed SHA, archives only ask,
config and the root license, and retains temporary staging for inspection; it
never uses working-tree edits or installed dependencies. Output is the tarball,
`SHA256SUMS` and `fork-release.json` with source/overlay manifests, provenance,
file counts and validation boundaries. Existing outputs are not overwritten.
An uncommitted-HEAD run is only a precommit preview: final provenance must name
the commit containing this recipe and documentation, not just the baseline.
The future immutable tag is `rpiv-ask-user-question-v2.12.0-yuchenhui.1` in
[`Yuchenhui/rpiv-mono`](https://github.com/Yuchenhui/rpiv-mono).

The private artifact redirects repository/homepage/bugs to the fork and bundles
real `@juicesharp/rpiv-config@2.12.0` files with MIT licensing. SDK and typebox
remain `*` host peers; optional i18n is not bundled (English fallback is the
baseline). Only `index.ts` is registered as a Pi extension. No workspace links,
SDK copies, tests, lifecycle scripts or publish configuration are shipped.
Packing uses `npm pack --ignore-scripts --workspaces=false --offline --json`
with an external destination and isolated empty npm configuration. The recipe
checks the bundle, actual tar members, extracted byte contents and exports.
This is reproducible source selection and file output, not a promise of
byte-identical archive timestamps or Linux deployment support.

Release upload/tag push, SHA verification, isolated offline factory loading and
Windows pinned installation are separate parent-reviewed steps. Neither this
recipe nor its static/archive validation runs regression suites, real models,
native CLI, extension events, installation, deployment or restart. Keep the
previous pinned artifact as the rollback source; cleanup requires separate
approval. After an authorized package-source change, fully exit and restart Pi,
then verify the installed source and runtime separately.

## Quick start

Nothing to set up — the tool is live as soon as Pi restarts. Hand the model a task with a real decision buried in it:

> Add caching to the API client.

Rather than picking a strategy on your behalf, the model calls `ask_user_question` and a dialog takes over the bottom of your terminal. Move with `↑`/`↓`, choose with `Enter`, press `n` to attach a note to a question — or a global note to the whole questionnaire from the Submit tab — or land on the `Type something.` row to answer in your own words. While typing, `Shift+Enter` adds a line, `Ctrl+G` opens Pi's configured external editor, and `Ctrl+U` clears the draft; browsing another option and returning keeps what you wrote. `Esc` abandons the questionnaire entirely.

When the questionnaire begins waiting in an interactive TTY, it emits one standard terminal BEL (`\x07`). Your terminal configuration determines whether that appears as an audible alert, a visual alert, or nothing; redirected and non-TTY output is untouched.

![Single question in the dialog: the tab strip reads Feature Type, Design Tab, Testing, Release, Submit; the question Which real development task are we planning right now? sits above four numbered options — Bug fix (Recommended), New feature, Refactor, Perf tuning — each with a one-line description, followed by the appended Type something. row](https://raw.githubusercontent.com/juicesharp/rpiv-mono/main/packages/rpiv-ask-user-question/docs/single-question.jpg)

When the model asks several things at once, `Tab` moves between them and a Submit tab reviews everything before it goes back:

![Submit tab of a four-question dialog: a Review your answers list showing Feature Type set to Bug fix and Testing set to Unit tests plus Integration tests, a warning naming Design Tab and Release as still unanswered, a picker offering Submit answers or Cancel, and a dim bottom key-hint row including n to add a note](https://raw.githubusercontent.com/juicesharp/rpiv-mono/main/packages/rpiv-ask-user-question/docs/submit-tab.jpg)

## What you get

- **Typed options instead of a wall of prose** — each question carries 2-4 authored choices, and every choice comes with a description of what it means or what it costs you.
- **You can always answer in your own words** — a `Type something.` row is appended to every question, single- or multi-select, widens to the full pane while you type, keeps its multiline draft visible in that row while you browse, and supports Pi's `Shift+Enter` newline and `Ctrl+G` external-editor flows.
- **Compare real artifacts, not just labels** — an option can carry a markdown `preview` (ASCII mockup, code, diagram, config) that renders in a bordered box beside the option list.
- **One interruption, not five** — up to four questions arrive in a single tabbed dialog, and the Submit tab lists your answers and names anything still blank before you commit.
- **Notes on any answer — or on all of them** — `n` opens a multiline note editor on any question tab, and on the Submit tab it opens one global note for the whole questionnaire. Per-question notes reach the model as `user notes: <text>`, the global note as `global note: <text>`; neither marks a question answered.
- **Read the transcript behind the dialog** — `Ctrl+]` collapses the overlay so you can scroll the conversation, then brings it back with your answers intact.
- **Works outside the terminal too** — in RPC and ACP hosts such as the VS Code pendant or Zed the questionnaire walks through the host's native dialogs (notes are terminal-only and do not carry over), and in non-interactive runs the tool is removed from the model's tool list instead of failing every call.

## Configuration

Optional. Settings live in `~/.config/rpiv-ask-user-question/config.json`; the file is read, never written.

| Setting | What it does | Default |
| --- | --- | --- |
| `collapseKey` | Key that collapses and expands the dialog. Accepts Pi keybinding ids such as `alt+o`; `"off"` disables the shortcut. | `"ctrl+]"` |
| `guidance.description` | Full replacement for the tool description the model sees. A non-empty string replaces the built-in text entirely — no merging. | built-in description |
| `guidance.promptSnippet` | One-line description of the tool in the system prompt — tune how eagerly the model asks. | built-in snippet |
| `guidance.promptGuidelines` | Usage guidelines given to the model, as a list of strings. | 4 built-in guidelines |

```json
{ "collapseKey": "alt+o" }
```

Malformed JSON falls back to the defaults with a warning; an individual unusable value is silently dropped back to its default. Never an error.

## Reference

- [Tool schema](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/docs/tool-schema.md) — parameters, limits, reserved labels, validation errors, the result envelope, and the `rpiv:ask-user:prompt` event.
- [Keyboard and layout](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/docs/keyboard.md) — every key, the rows the dialog appends, notes, collapse mode, and how previews and overflow adapt to terminal size.
- [Configuration](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/docs/configuration.md) — file lookup and `XDG_CONFIG_HOME`, the `collapseKey` grammar, the `guidance.*` prompt overrides, and how invalid values are handled.
- [Hosts and runtime behavior](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/docs/hosts.md) — terminal vs RPC vs non-interactive, what degrades in each, and the load-failure envelopes.
- [Localization](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/docs/localization.md) — the nine shipped languages, how the locale is chosen, and how to add one.

## Requirements

- Node.js 22 or newer.
- Pi Agent, with an interactive terminal or an RPC/ACP host. Non-interactive runs never see the tool.
- A terminal at least 100 columns wide for side-by-side previews; narrower terminals stack the preview under the options.

No native dependencies, no compiler, no API keys — the extension makes no model calls of its own.

## Troubleshooting

**The model says the questionnaire UI failed to load and asks its questions as chat text.** The dialog's modules were replaced on disk while Pi was running, usually by a package-manager install touching the store. Repair the install if it is broken, then restart Pi; the failure is not recoverable inside the running process.

**`Ctrl+]` does nothing.** On keyboard layouts where `]` sits on the shifted layer (Latin American among them) the default is unreachable. Set `collapseKey` to something you can type, for example `"alt+o"`.

## Related

- [`@juicesharp/rpiv-i18n`](https://www.npmjs.com/package/@juicesharp/rpiv-i18n) — optional; installing it renders the dialog chrome in your language and adds `/languages`.
- [`@juicesharp/rpiv-pi`](https://www.npmjs.com/package/@juicesharp/rpiv-pi) — the umbrella package whose workflow skills use `ask_user_question` as their developer checkpoint. `/rpiv-setup` offers to install this extension.

## License

MIT — see [LICENSE](https://github.com/juicesharp/rpiv-mono/blob/main/packages/rpiv-ask-user-question/LICENSE).
