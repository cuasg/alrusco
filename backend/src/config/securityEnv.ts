/**
 * Validates environment for production deployments.
 * Call from server startup before listening.
 */
export function assertProductionSecurity(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Production requires JWT_SECRET with at least 32 characters. Generate e.g. `openssl rand -hex 32`.",
    );
  }

  const weak = new Set([
    "change-me-in-prod",
    "change-me",
    "secret",
    "jwt-secret",
    "your-secret-here",
  ]);
  if (weak.has(secret.trim().toLowerCase())) {
    throw new Error(
      "Production requires a strong unique JWT_SECRET (not a placeholder).",
    );
  }

  // eslint-disable-next-line no-console
  console.info(
    "[security] Production mode: use HTTPS in the browser (reverse proxy TLS). Session cookies are Secure.",
  );

  const trustVal = Number(process.env.TRUST_PROXY_HOPS ?? "1");
  if (!Number.isFinite(trustVal) || trustVal < 1) {
    // eslint-disable-next-line no-console
    console.warn(
      "[security] TRUST_PROXY_HOPS resolves to an invalid or zero value; rate limiting and req.ip may be wrong behind a reverse proxy. Set TRUST_PROXY_HOPS=1 (or your hop count).",
    );
  }
}

/** Whether first-user bootstrap is allowed (locked off in production by default). */
export function isBootstrapAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.ALLOW_BOOTSTRAP === "true";
}
