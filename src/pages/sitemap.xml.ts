import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ site }) => {
	const baseSite = (
		site ?? new URL(import.meta.env.SITE || "https://aigene.studio/")
	).href.replace(/\/$/, "");
	const indexUrl = `${baseSite}/sitemap-index.xml`;

	try {
		const res = await fetch(indexUrl);
		if (res.ok) {
			const body = await res.text();
			return new Response(body, {
				headers: {
					"Content-Type": "application/xml; charset=utf-8",
				},
			});
		}
	} catch {
		// Fallback to static declaration if fetch during build cannot reach server
	}

	const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<sitemap>
		<loc>${baseSite}/sitemap-0.xml</loc>
	</sitemap>
</sitemapindex>`.trim();

	return new Response(fallbackXml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};
