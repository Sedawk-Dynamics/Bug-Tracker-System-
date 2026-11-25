// Behind Dokploy's Traefik proxy, req.url holds the container address, so use the configured public URL.
export function publicOrigin(req: Request) { return new URL(process.env.PUBLIC_URL || req.url).origin; }
// Traefik appends the real client address last; earlier entries can be forged by the client.
export function clientIp(req: Request) { return req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'local'; }
