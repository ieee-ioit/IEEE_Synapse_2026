import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/format";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/rules", "/schedule"].map((p) => ({ url: `${siteUrl()}${p}` }));
}
