import { Request } from 'express';
import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';

export function signinRateKey(request: Request) {
  // Render public ingress always traverses Cloudflare, which overwrites this header.
  // Never trust it on local/other hosting, or use the client-controlled first XFF entry.
  const cloudflare = process.env.RENDER === 'true' ? request.get('cf-connecting-ip') : undefined;
  const address =
    cloudflare && isIP(cloudflare)
      ? cloudflare
      : request.ip || request.socket.remoteAddress || 'unknown';
  return ipKeyGenerator(address);
}
