'use client';

import { useSession } from 'next-auth/react';
import { NotificationDropdown } from './notification-dropdown';

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Arbati ERP</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <NotificationDropdown />
          <span className="text-sm text-gray-600">
            {session?.user?.name || session?.user?.email}
          </span>
          {(session?.user as any)?.role && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
              {(session?.user as any).role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

