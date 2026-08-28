import Link from 'next/link';
import { BadgeCheck, GraduationCap, Mail, MailWarning, MessageCircle, Pencil, Phone, Plus, Search, ShieldOff } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { CustomerForm } from '@/components/admin/PeopleForms';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { whatsappLink } from '@/lib/utils';
import { deleteCustomerAction } from '@/server/actions/people';
import { requirePermission } from '@/lib/auth';
import { contient } from '@/lib/db-search';

export const metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

/**
 * Filtres du CRM. Ils portent sur le compte en ligne rattaché à la fiche :
 * une fiche créée au comptoir n'a pas de compte et n'apparaît donc que dans
 * « Toutes » et « Sans compte ».
 */
const FILTRES = [
  { cle: '', libelle: 'Toutes' },
  { cle: 'verifiees', libelle: 'Vérifiées' },
  { cle: 'non-verifiees', libelle: 'Non vérifiées' },
  { cle: 'actives', libelle: 'Actives' },
  { cle: 'desactivees', libelle: 'Désactivées' },
  { cle: 'sans-compte', libelle: 'Sans compte' },
] as const;

function filtreCompte(cle: string): Prisma.CustomerWhereInput {
  switch (cle) {
    case 'verifiees':
      return { user: { is: { emailVerified: true } } };
    case 'non-verifiees':
      return { user: { is: { emailVerified: false } } };
    case 'actives':
      return { user: { is: { isActive: true } } };
    case 'desactivees':
      return { user: { is: { isActive: false } } };
    case 'sans-compte':
      return { userId: null };
    default:
      return {};
  }
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string };
}) {
  await requirePermission('customers.manage');
  const q = (searchParams.q ?? '').trim();
  const statut = searchParams.statut ?? '';

  const recherche: Prisma.CustomerWhereInput = q
    ? { OR: [{ fullName: contient(q) }, { phone: contient(q) }, { email: contient(q) }] }
    : {};

  const where: Prisma.CustomerWhereInput = { AND: [recherche, filtreCompte(statut)] };

  const [customers, compteurs] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: { select: { appointments: true } },
        appointments: { orderBy: { scheduledAt: 'desc' }, take: 1, include: { service: { select: { name: true } } } },
        payments: { where: { status: 'PAYE' }, select: { amount: true } },
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            emailVerifiedAt: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
            student: {
              select: {
                enrollments: {
                  select: { status: true, course: { select: { name: true } } },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    Promise.all(
      FILTRES.map(async (f) => ({
        cle: f.cle,
        total: await prisma.customer.count({ where: { AND: [recherche, filtreCompte(f.cle)] } }),
      })),
    ),
  ]);

  const total = (cle: string) => compteurs.find((c) => c.cle === cle)?.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">CRM</p>
          <h1 className="section-title">Clientes</h1>
        </div>
        <form method="get" className="relative">
          {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Nom, téléphone, email…" className="w-64 pl-9" />
        </form>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvelle cliente</>}>
        <CustomerForm customer={null} />
      </Disclosure>

      <div className="flex flex-wrap gap-2">
        {FILTRES.map((f) => {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (f.cle) params.set('statut', f.cle);
          const href = params.toString() ? `/admin/clients?${params}` : '/admin/clients';
          return (
            <Link key={f.cle || 'toutes'} href={href} className={statut === f.cle ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
              {f.libelle} <span className="opacity-60">({total(f.cle)})</span>
            </Link>
          );
        })}
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="Aucune cliente"
          description="Aucune fiche ne correspond à ce filtre. Les fiches créées lors des réservations apparaissent ici."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => {
            const regle = c.payments.reduce((s, p) => s + p.amount, 0);
            const wa = whatsappLink(c.whatsapp ?? c.phone);
            const compte = c.user;
            const formations = compte?.student?.enrollments ?? [];
            return (
              <Card key={c.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-cream">{c.fullName}</p>
                    <p className="text-xs text-cream-dim">Cliente depuis le {formatDateShort(c.createdAt)}</p>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <a href={`tel:${c.phone}`} className="chip hover:text-cream">
                    <Phone size={12} /> {c.phone}
                  </a>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="chip hover:text-cream">
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  ) : null}
                </div>

                {/* Etat du compte en ligne */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {!compte ? (
                    <span className="chip">Sans compte en ligne</span>
                  ) : (
                    <>
                      <span className="chip">
                        <Mail size={12} /> {compte.email ?? c.email ?? '—'}
                      </span>
                      {compte.emailVerified ? (
                        <span className="chip border-emerald-400/30 text-emerald-200">
                          <BadgeCheck size={12} /> E-mail vérifié
                          {compte.emailVerifiedAt ? ` · ${formatDateShort(compte.emailVerifiedAt)}` : ''}
                        </span>
                      ) : (
                        <span className="chip border-amber-400/30 text-amber-200">
                          <MailWarning size={12} /> E-mail non vérifié
                        </span>
                      )}
                      {!compte.isActive ? (
                        <span className="chip border-red-400/30 text-red-200">
                          <ShieldOff size={12} /> Compte désactivé
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-cream-dim">Rendez-vous</dt>
                    <dd className="text-cream">{c._count.appointments}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-dim">Total réglé</dt>
                    <dd className="text-gold-300">{formatMoney(regle)}</dd>
                  </div>
                  {compte ? (
                    <>
                      <div>
                        <dt className="text-cream-dim">Inscription</dt>
                        <dd className="text-cream">{formatDateShort(compte.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-cream-dim">Dernière connexion</dt>
                        <dd className="text-cream">{compte.lastLoginAt ? formatDateShort(compte.lastLoginAt) : 'Jamais'}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                {formations.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {formations.map((e, i) => (
                      <span key={i} className="chip">
                        <GraduationCap size={12} /> {e.course.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                {c.appointments[0] ? (
                  <p className="mb-3 text-xs text-cream-muted">
                    Dernier RDV : {c.appointments[0].service.name} · {formatDateShort(c.appointments[0].scheduledAt)}
                  </p>
                ) : null}

                {c.notes ? <p className="mb-3 text-xs italic text-cream-dim">« {c.notes} »</p> : null}

                <div className="space-y-2">
                  <Disclosure variant="row" label={<><Pencil size={13} /> Modifier la fiche</>}>
                    <CustomerForm
                      customer={{
                        id: c.id,
                        fullName: c.fullName,
                        phone: c.phone,
                        whatsapp: c.whatsapp,
                        email: c.email,
                        address: c.address,
                        notes: c.notes,
                      }}
                    />
                  </Disclosure>
                  {c._count.appointments === 0 ? (
                    <form action={deleteCustomerAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                        Supprimer
                      </button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
