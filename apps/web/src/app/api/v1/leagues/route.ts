import { getProvider } from '@/lib/provider';
import { handle, json } from '@/lib/api';

export const revalidate = 3600;

export function GET() {
  return handle(async () => json(await getProvider().getLeagues()));
}
