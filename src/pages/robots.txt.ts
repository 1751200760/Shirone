import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL("https://aigene.studio/");
	const sitemapUrl = new URL("sitemap.xml", siteUrl).href;
	const sitemapIndexUrl = new URL("sitemap-index.xml", siteUrl).href;
	const llmsUrl = new URL("llms.txt", siteUrl).href;
	const llmsFullUrl = new URL("llms-full.txt", siteUrl).href;

	const robotsTxt = `
User-agent: *
Allow: /
Disallow: /_astro/
Disallow: /api/

# Sitemap
Sitemap: ${sitemapUrl}
Sitemap: ${sitemapIndexUrl}

# LLMs & AI Agents Context
# ${llmsUrl}
# ${llmsFullUrl}
`.trim();

	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
