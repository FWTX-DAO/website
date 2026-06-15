import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import react from "@astrojs/react";

const LUMA_EVENTS_URL = "https://luma.com/fwtxdao";

// https://astro.build/config
export default defineConfig({
  site: "https://fwtx.city",
  redirects: {
    "/events": LUMA_EVENTS_URL,
  },
  integrations: [tailwind(), mdx(), sitemap(), icon(), react()],
});
