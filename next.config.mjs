/** @type {import('next').NextConfig} */

// Content-Security-Policy. Allows self + the Desmos calculator origin (loaded
// client-side for Math). 'unsafe-inline'/'unsafe-eval' are required by Next.js
// hydration, Tailwind's injected styles, and Desmos; a nonce-based strict CSP
// is the further-hardening path if needed.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.desmos.com https://*.desmos.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.desmos.com https://*.desmos.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.desmos.com https://*.desmos.com",
  "frame-src 'self' https://www.desmos.com https://*.desmos.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
