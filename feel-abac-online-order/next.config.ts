import type { NextConfig } from "next";

type RemotePattern = NonNullable<NextConfig["images"]>["remotePatterns"][number];

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "cdn.feelabac.com",
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

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
  },
};

export default nextConfig;
