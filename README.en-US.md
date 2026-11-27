# Tau Plugin Template

This is the official plugin template for [Tau](https://taunote.app). Write plugins with TypeScript and React, bundle them into a single ZIP, and publish to the Plugin Center so users can install them on desktop, Android, and iOS. Plugins can add pages and navigation entries to Tau, place panels on the Home page, add custom blocks in documents, add elements on whiteboards, provide tools for AI, integrate third-party storage and voice services, or read and write cards and tasks.

The template ships with a ready-to-run Counter example: click **Increment and save** to persist the count per workspace across sessions. Once installed, find **Counter** in the Sidebar on desktop, or in the feature grid at the top of **Me** on mobile.

## Get Running in 3 Steps

1. Click **Use this template** on GitHub to create your own repository, then clone it locally.
2. Install dependencies and build; the plugin ZIP will be generated under `dist/`:

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. Install the ZIP into a Tau dev build, enable it, and open **Counter**. See [Getting Started · Debugging in Tau](docs/getting-started.md#在-tau-里调试).

## Documentation

- Read online: <https://taunote.app/developers/>
- Local [docs/](docs/README.md) in this repo: the same content as the website—start with [Getting Started](docs/getting-started.md).
- When building a plugin with an AI coding assistant, have it read [AGENTS.md](AGENTS.md) first.

## Publishing Your Own Plugin

This README is displayed under **Description** on the plugin details page. Once you customize this template into your own plugin, rewrite it as end-user documentation covering what the plugin does, how to get started, and common questions. See [Publishing & Updating](docs/release.md) for guidelines.
