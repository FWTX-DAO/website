# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FWTX DAO website - A static site built with Astro for the Fort Worth Municipal DAO, focusing on Web3 civic initiatives and community building.

## Development Commands

```bash
# Install dependencies (use pnpm recommended)
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Access Astro CLI
pnpm astro
```

## Architecture & Code Structure

### Tech Stack
- **Framework**: Astro v3.5.5 (static site generator)
- **Styling**: Tailwind CSS with Typography plugin
- **Content**: Astro Content Collections with Zod validation
- **Components**: `.astro` files with TypeScript support

### Key Directories
- `src/pages/` - File-based routing (each file = route)
- `src/components/` - Reusable Astro components
  - `navbar/` - Navigation components with dropdown support
  - `ui/` - Base UI components (button, link, container, icons)
- `src/content/` - Content collections with type-safe schemas
  - `blog/` - Blog posts in Markdown/MDX
  - `team/` - Team member profiles
- `src/layouts/` - Page layouts with SEO configuration
- `src/assets/` - Images and static assets (optimized at build)

### Important Patterns

**Component Development**: Components use Astro's `.astro` format combining markup, styles, and scripts. Props are typed with TypeScript interfaces.

**Content Collections**: Blog posts and team profiles use frontmatter validated by Zod schemas defined in `src/content/config.ts`:
- Blog: draft, title, snippet, image, publishDate, author, category, tags
- Team: draft, name, title, avatar, publishDate

**Path Aliases**: Use `@` aliases configured in tsconfig.json for clean imports.

**Image Optimization**: Images in `src/assets/` are automatically optimized with Sharp during build.

## External Resources & Integrations

- **Community**: Discord and Telegram links in navigation
- **GitHub**: Multiple educational repositories linked
- **Events**: Meetup integration for community events
- **Site URL**: https://fwtx.city

## Development Notes

- No linting or formatting configured - follow existing code style
- No testing framework - manual verification required
- Static site with no API endpoints or server-side logic
- SEO managed through astro-seo in Layout component
- Responsive design using Tailwind breakpoints