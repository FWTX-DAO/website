# FWTX DAO

Use Node.js 22.23.4 (`nvm use`), Node.js 24.22.1+, or Node.js 26.12.1+.
The engine ranges in `package.json` require the October 2026 security patches.

## Installation

If you are reading this on github, you can click on the "Use this template" button above to create a new repository from astroship to your account. Then you can do a `git clone` to clone it to your local system.

Alternatively, you can clone the project directly from this repo to your local system.

### 1. Clone the repo

```bash
git clone https://github.com/FWTX-DAO/website.git myProjectName
# or
git clone https://github.com/FWTX-DAO/website.git .
```

The `.` will clone it to the current directory so make sure you are inside your project folder first.

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or (recommended)
pnpm install
# or, with Bun 1.4.4 or newer
bun install --frozen-lockfile
```

### 3. Start development Server

```bash
npm run dev
# or
yarn dev
# or (recommended)
pnpm dev
```

### Preview & Build

```bash
npm run preview
npm run build
# or
yarn preview
yarn build
# or (recommended)
pnpm preview
pnpm build
```

We recommend using [pnpm](https://pnpm.io/) to save disk space on your computer.

### Dependency Updates

```bash
bun update --latest
pnpm update --lockfile-only
bun audit
pnpm audit
bun run build
```

Commit both `bun.lock` and `pnpm-lock.yaml` after updates. Keep the security
overrides in `package.json` and `pnpm-workspace.yaml` aligned; they patch
transitive dependencies whose upstream packages still pin vulnerable versions.
Tailwind CSS v4 runs through `@tailwindcss/postcss` and loads the existing
theme from `tailwind.config.cjs`.

### Other Commands

```bash
pnpm astro ...
pnpm astro add
pnpm astro --help
```

## Project Structure

Inside of your Astro project, you'll see the following folders and files:

```
/
├── public/
│   └── ...
├── src/
│   ├── components/
│   │   └── ...
│   ├── layouts/
│   │   └── ...
│   └── pages/
│       └── ...
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

Any static assets, like images, can be placed in the `public/` directory.

## TailwindCSS

TailwindCSS is already configured in this repo, so you can start using it without any installation.

## Credits

[Hero Illustration](https://www.figma.com/community/file/1108400791662599811) by [Streamline](https://www.streamlinehq.com/)

## 👀 Want to learn more?

Feel free to check out [Astro Docs](https://docs.astro.build) or jump into our [Discord Chat](https://web3templates.com/discord).

[![Built with Astro](https://astro.badg.es/v1/built-with-astro.svg)](https://astro.build)
