import { MobileNav } from '@/components/layout/MobileNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader, type HeaderUser } from '@/components/layout/SiteHeader';
import { WhatsAppFab } from '@/components/WhatsAppFab';
import { whatsappLink } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { homePathFor, isStaff } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';
import { bannieresActives } from '@/server/marketing';
import { AnnonceCarte, versAnnonce } from '@/components/public/Annonce';
import { BANNER_PLACEMENTS } from '@/lib/constants';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, bannieresBas] = await Promise.all([
    getSettings(),
    getCurrentUser().catch(() => null),
    bannieresActives(BANNER_PLACEMENTS.BAS_DE_PAGE, 3),
  ]);

  let headerUser: HeaderUser = null;
  if (user) {
    const unread = await prisma.notification
      .count({ where: { userId: user.id, isRead: false } })
      .catch(() => 0);
    headerUser = {
      fullName: user.fullName,
      role: ROLE_LABELS[user.role as Role] ?? user.role,
      isStaff: isStaff(user.role),
      homePath: homePathFor(user.role),
      unread,
    };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader user={headerUser} logoUrl={resolveLogo(settings['shop.logoUrl'])} shopName={settings['shop.name']} />
      <main className="flex-1 pb-24 lg:pb-0">{children}</main>
      {/* Bannieres de bas de page : presentes sur toutes les pages publiques */}
      {bannieresBas.length > 0 ? (
        <section className="container-page mb-10">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bannieresBas.map((b) => (
              <AnnonceCarte key={b.id} annonce={versAnnonce(b)} />
            ))}
          </div>
        </section>
      ) : null}
      <SiteFooter settings={settings} />
      <WhatsAppFab
        href={whatsappLink(
          settings['shop.whatsapp'] || settings['shop.phone'],
          `Bonjour ${settings['shop.name']}, je souhaite des informations.`,
        )}
      />
      <MobileNav />
    </div>
  );
}
