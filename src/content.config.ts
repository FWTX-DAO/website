import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    draft: z.boolean(),
    title: z.string(),
    snippet: z.string(),
    image: z.object({
      src: z.string(),
      alt: z.string(),
      caption: z.string().optional(),
      source: z
        .object({
          label: z.string(),
          url: z.string().url(),
        })
        .optional(),
    }),
    publishDate: z.coerce.date(),
    author: z.string().default("FWTX DAO - Research"),
    category: z.string(),
    tags: z.array(z.string()),
  }),
});

const team = defineCollection({
  loader: glob({ base: "./src/content/team", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    draft: z.boolean(),
    name: z.string(),
    title: z.string(),
    avatar: z.object({
      src: z.string(),
      alt: z.string(),
    }),
    publishDate: z.coerce.date(),
  }),
});

export const collections = { blog, team };
