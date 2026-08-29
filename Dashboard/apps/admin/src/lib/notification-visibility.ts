import type { AdminNotification } from './api-hooks';

/**
 * Maps a notification type to the dashboard permission required to see it.
 *
 * Notifications for features that have been retired (e.g. `USER` — the Users
 * section was removed) have no entry, so they are hidden from every role.
 */
export const NOTIFICATION_TYPE_PERMISSION: Record<string, string> = {
  ORDER: 'orders:view',
  INVENTORY: 'inventory:view',
  SUPPORT: 'support:view',
  SETTINGS: 'settings:view',
  SYSTEM: 'dashboard:view',
};

/**
 * Filter notifications down to only those the current user has permission to
 * see. Applied in BOTH the header bell (icon + dropdown) and the dedicated
 * Notifications page so they stay in sync.
 */
export function filterNotificationsByPermission(
  notifications: AdminNotification[],
  hasPermission: (permission: string) => boolean,
): AdminNotification[] {
  return notifications.filter((n) => {
    const permission = NOTIFICATION_TYPE_PERMISSION[n.type];
    // Unknown / retired type (e.g. USER) — not surfaced to anyone.
    if (!permission) return false;
    return hasPermission(permission);
  });
}
