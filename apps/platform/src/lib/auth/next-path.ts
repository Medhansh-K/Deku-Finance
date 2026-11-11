/** Post-login redirect target: same-site paths only ("//evil.com" or "/\\evil.com" would leave the site). */
export function safeNextPath(requested: string | null): string {
  return requested && /^\/(?![/\\])/.test(requested) ? requested : "/gateway";
}
