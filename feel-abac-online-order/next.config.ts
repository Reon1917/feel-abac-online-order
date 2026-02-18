import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
};

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "cdn.feelabac.com",
    pathname: "/**",
  },
  // UploadThing CDN domains
  {
    protocol: "https",
    hostname: "utfs.io",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "uploadthing.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "uploadthing-prod.s3.us-west-2.amazonaws.com",
    pathname: "/**",
  },
  // UploadThing v7+ uses *.ufs.sh domains
  {
    protocol: "https",
    hostname: "*.ufs.sh",
    pathname: "/**",
  },
];

function registerRemotePattern(raw?: string | null) {
  if (!raw) return;
  try {
    const url = new URL(raw);
    const protocol = url.protocol.replace(":", "");
    if (protocol !== "https" && protocol !== "http") {
      return;
    }

    const sanitizedPath =
      url.pathname === "/" || url.pathname === ""
        ? "/**"
        : `${url.pathname.replace(/\/$/, "")}/**`;

    // Avoid duplicates for the same hostname/path combination.
    if (
      !remotePatterns.some(
        (pattern) =>
          pattern.hostname === url.hostname && pattern.pathname === sanitizedPath
      )
    ) {
      remotePatterns.push({
        protocol: protocol as "https" | "http",
        hostname: url.hostname,
        pathname: sanitizedPath,
      });
    }
  } catch {
    // Ignore invalid URLs to keep build stable.
  }
}

registerRemotePattern(process.env.R2_PUBLIC_BUCKET_URL);
registerRemotePattern(process.env.R2_S3_ENDPOINT);

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    minimumCacheTTL: ONE_YEAR_IN_SECONDS,
    formats: ["image/avif", "image/webp"],
    qualities: [75, 82],
  },
};

export default nextConfig;
