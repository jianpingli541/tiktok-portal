import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';

export default function Sidebar() {
  const { t } = useTranslation();
  const open = useUIStore((s) => s.sidebarOpen);
  const links = [
    { to: '/submit', label: t('nav.submit') },
    { to: '/tasks', label: t('nav.tasks') },
    { to: '/account', label: t('nav.account') },
    { to: '/billing', label: t('nav.billing') },
  ];
  return (
    <aside className={cn('border-r p-4 transition-all', open ? 'w-56' : 'w-14')}>
      <nav className="flex flex-col gap-2">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              cn('rounded px-3 py-2 text-sm', isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')
            }
          >
            {open ? l.label : l.label[0]}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
