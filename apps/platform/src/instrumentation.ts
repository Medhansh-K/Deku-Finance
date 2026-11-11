// Runs once when the server starts. Without these the app starts anyway and fails on every request,
// signing users out, so a misconfigured deployment should stop here with a clear message.
export function register() {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME !== "nodejs") return;
  // Vercel frontend-only deployments host public and browser-demo routes without the backend container.
  if (process.env.VERCEL) return;
  const missing = ["JWT_SECRET", "BACKEND_URL"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Deku Finance can't start: set ${missing.join(" and ")}.`);
    process.exit(1);
  }
}
