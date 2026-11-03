import type { UserRole } from '../services/api.service';

export type LoginPortal = 'staff' | 'admin';

export function isRestaurantAdmin(role?: string): boolean {
  return role === 'owner' || role === 'admin';
}

export function staffHome(role?: UserRole): string {
  if (role === 'kitchen') return '/kitchen';
  if (role === 'bartender') return '/bar';
  if (role === 'receptionist') return '/tables';
  if (role === 'owner' || role === 'admin' || role === 'waiter') return '/staff/pos';
  return '/dashboard';
}

/** Fixed internal destinations: a portal choice never grants a role. */
export function restaurantHome(role?: UserRole, portal?: LoginPortal | null): string {
  if (portal !== 'staff' && isRestaurantAdmin(role)) return '/settings';
  return staffHome(role);
}

export function loginPathFor(url: string): string {
  const path = url.split('?')[0];
  if (/^\/(settings|users|reports|products|inventory|translations)(\/|$)/.test(path)) return '/admin/login';
  if (/^\/(staff|orders|tables|kitchen|bar|working-plan|my-shift)(\/|$)/.test(path)) return '/staff/login';
  return '/login';
}
