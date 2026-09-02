import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api", "/payment"],
      },
    ],
    sitemap: "https://helpsell.ru/sitemap.xml",
    host: "https://helpsell.ru",
  };
}