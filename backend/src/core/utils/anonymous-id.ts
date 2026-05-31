import { randomInt } from 'crypto';

export function generateAnonymousDisplayId(): string {
  return `Anon#${randomInt(0, 10000).toString().padStart(4, '0')}`;
}
