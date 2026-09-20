import { LEAGUES } from '@sports/core';
import type { Locale } from '@sports/i18n';
import { redirect } from '@/i18n/navigation';

export default async function TablesIndex({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  redirect({ href: `/tables/${LEAGUES[0]!.slug}`, locale });
}
