import { notFound } from 'next/navigation';

/**
 * Any unknown address under /admin. It lives inside the console layout, so a visitor who is
 * not an admin is sent to the login page before learning whether an address exists.
 */
export default function AdminCatchAll() {
  notFound();
}
