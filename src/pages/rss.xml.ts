import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const feedTitle = "FWTX DAO Blog";
const feedDescription =
  "Research and thought leadership on Web3, DAOs, cybersecurity, and civic innovation in Fort Worth, Texas.";

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("The RSS feed requires `site` to be configured in astro.config.mjs.");
  }

  const publishedPosts = await getCollection("blog", ({ data }) => {
    return !data.draft && data.publishDate < new Date();
  });

  publishedPosts.sort((a, b) => {
    return b.data.publishDate.valueOf() - a.data.publishDate.valueOf();
  });

  const feedUrl = new URL("/rss.xml", site).toString();

  return rss({
    title: feedTitle,
    description: feedDescription,
    site,
    items: publishedPosts.map(({ data, id }) => ({
      title: data.title,
      description: data.snippet,
      pubDate: data.publishDate,
      link: `/blog/${id}/`,
      categories: [data.category, ...data.tags],
    })),
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
    },
    customData: `<language>en-us</language><atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />`,
  });
};
