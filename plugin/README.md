# Clipisode Plugin

WordPress plugin directory. Each subdirectory is a separate plugin that WordPress can discover when placed in `wp-content/plugins/`.

## Contents

- `clipisode/` — The main plugin.
- `clipisode-community-theme/` — A video theme using Clipisode's branded renderer.
- `clipisode-studio-theme/` — A video theme with its own renderer script.
- `AGENTS.md` — AI agent rules and local environment access notes.

Install the main plugin first. Copy or symlink either theme directory beside it in `wp-content/plugins/`. WordPress lists each theme as a separate plugin and requires Clipisode to be active before it can be activated.
