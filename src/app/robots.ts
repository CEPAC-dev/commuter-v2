import type { MetadataRoute } from "next";
import { getPrimaryAppUrl } from "@/lib/appUrl";

const siteUrl = getPrimaryAppUrl(process.env.APP_URL);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/checkout/", "/create", "/login", "/profile/", "/wallet/", "/my-requests/", "/my-trips/", "/ride-requests/", "/availability/", "/user/", "/live/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
