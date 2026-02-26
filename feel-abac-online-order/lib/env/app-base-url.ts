const LOCAL_BASE_URL = "http://localhost:3000";

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isLocalhostBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function getAppBaseUrl() {
  const isProduction = process.env.NODE_ENV === "production";
  const vercelProjectProductionUrl = normalizeBaseUrl(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  );
  const vercelRuntimeUrl = normalizeBaseUrl(process.env.VERCEL_URL);

  if (isProduction) {
    const appOrigin = normalizeBaseUrl(process.env.APP_ORIGIN);
    const publicAppOrigin = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_ORIGIN);

    const productionCandidates = [
      process.env.APP_BASE_URL,
      process.env.APP_ORIGIN,
      process.env.NEXT_PUBLIC_APP_BASE_URL,
      process.env.NEXT_PUBLIC_APP_ORIGIN,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.BETTER_AUTH_URL,
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
      vercelProjectProductionUrl,
      vercelRuntimeUrl,
    ]
      .map((candidate) => normalizeBaseUrl(candidate))
      .filter((candidate): candidate is string => Boolean(candidate));

    const nonLocalhostCandidate = productionCandidates.find(
      (candidate) => !isLocalhostBaseUrl(candidate)
    );

    if (nonLocalhostCandidate) {
      return nonLocalhostCandidate;
    }

    const localhostCandidate = productionCandidates[0];
    if (localhostCandidate) {
      // Allow explicit APP_ORIGIN localhost values for local production builds.
      if (appOrigin && isLocalhostBaseUrl(appOrigin)) {
        return appOrigin;
      }
      if (publicAppOrigin && isLocalhostBaseUrl(publicAppOrigin)) {
        return publicAppOrigin;
      }
      throw new Error(
        "[app-base-url] Production base URL resolved to localhost. Set APP_BASE_URL, BETTER_AUTH_URL, or APP_ORIGIN to your public domain."
      );
    }

    throw new Error(
      "[app-base-url] Missing production base URL. Set APP_BASE_URL, BETTER_AUTH_URL, or APP_ORIGIN."
    );
  }

  const developmentCandidates = [
    process.env.APP_ORIGIN,
    process.env.BETTER_AUTH_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    vercelRuntimeUrl,
  ]
    .map((candidate) => normalizeBaseUrl(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  return developmentCandidates[0] ?? LOCAL_BASE_URL;
}
