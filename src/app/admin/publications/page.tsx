import Link from 'next/link';
import { CalendarRange, Copy, Eye, EyeOff, Image as ImageIcon, Plus, Search, Trash2 } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { PostForm } from '@/components/admin/MarketingForms';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { contient } from '@/lib/db-search';
import { requirePermission } from '@/lib/auth';
import { POST_STATUS, POST_STATUS_LABELS, POST_STATUS_VALUES, type PostStatus } from '@/lib/constants';
import {
  changerStatutPostAction,
  deletePostAction,
  dupliquerPostAction,
  retirerImageAction,
} from '@/server/actions/marketing';
import { etatDiffusion } from '@/server/marketing';
import { optionsMarketing } from '@/server/marketing-options';

export const metadata = { title: 'Publications' };
export const dynamic = 'force-dynamic';

const TONS: Record<string, string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  tension: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  ferme: 'border-red-400/30 bg-red-400/10 text-red-200',
  neutre: 'chip',
};

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

export default async function AdminPublicationsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string };
}) {
  await requirePermission('marketing.manage');

  const q = (searchParams.q ?? '').trim();
  const statut = searchParams.statut ?? '';

  const where: Prisma.PostWhereInput = {
    AND: [q ? { OR: [{ title: contient(q) }, { subtitle: contient(q) }] } : {}, statut ? { status: statut } : {}],
  };

  const [posts, options, groupes] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        course: { select: { name: true } },
        session: { select: { title: true, course: { select: { name: true } } } },
      },
    }),
    optionsMarketing(),
    prisma.post.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const compte = (s: string) => groupes.find((g) => g.status === s)?._count._all ?? 0;
  const totalToutes = groupes.reduce((n, g) => n + g._count._all, 0);
  const maintenant = new Date();

  const lien = (modif: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, statut, ...modif })) if (v) p.set(k, v);
    return p.toString() ? `/admin/publications?${p}` : '/admin/publications';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Marketing</p>
          <h1 className="section-title">Publications</h1>
          <p className="mt-2 max-w-2xl text-sm text-cream-muted">
            Une publication annonce une nouveauté sur le site. Reliez-la à une session : les dates, le prix et les
            places s’affichent alors tout seuls et restent justes.
          </p>
        </div>
        <form method="get" className="relative">
          {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Titre de la publication…" className="w-64 pl-9" />
        </form>
      </div>

      <Disclosure
        label={
          <>
            <Plus size={15} /> Nouvelle publication
          </>
        }
      >
        <PostForm formations={options.formations} sessions={options.sessions} />
      </Disclosure>

      <div className="flex flex-wrap gap-2">
        <Link href={lien({ statut: '' })} className={statut === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Toutes ({totalToutes})
        </Link>
        {POST_STATUS_VALUES.map((s) => (
          <Link key={s} href={lien({ statut: s })} className={statut === s ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
            {POST_STATUS_LABELS[s]} ({compte(s)})
          </Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="Aucune publication"
          description="Créez une publication pour annoncer une session, une nouveauté ou une offre."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((p) => {
            const etat = etatDiffusion({ status: p.status, debut: p.publishedAt, fin: p.expiresAt }, maintenant);
            const rattachement = p.session ? `${p.session.course.name} — ${p.session.title}` : (p.course?.name ?? null);
            return (
              <Card key={p.id}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-cream">{p.title}</p>
                    {p.subtitle ? <p className="text-sm text-cream-muted">{p.subtitle}</p> : null}
                  </div>
                  <span className={`chip shrink-0 ${TONS[etat.ton] ?? ''}`}>{etat.libelle}</span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  <span className="chip">{POST_STATUS_LABELS[p.status as PostStatus] ?? p.status}</span>
                  {rattachement ? <span className="chip">{rattachement}</span> : null}
                  {p.price !== null ? <span className="chip text-gold-300">{formatMoney(p.price)}</span> : null}
                  {p.publishedAt || p.expiresAt ? (
                    <span className="chip">
                      <CalendarRange size={12} />
                      {p.publishedAt ? formatDateShort(p.publishedAt) : '…'}
                      {' → '}
                      {p.expiresAt ? formatDateShort(p.expiresAt) : '…'}
                    </span>
                  ) : null}
                  {p.imageUrl ? (
                    <span className="chip">
                      <ImageIcon size={12} /> visuel
                    </span>
                  ) : null}
                </div>

                <p className="mb-3 line-clamp-2 text-sm text-cream-muted">{p.body}</p>

                {/* Actions rapides : publier, dépublier, archiver, dupliquer */}
                <div className="mb-2 flex flex-wrap gap-2">
                  {p.status !== POST_STATUS.PUBLIEE ? (
                    <form action={changerStatutPostAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={POST_STATUS.PUBLIEE} />
                      <button type="submit" className="btn-outline px-3 py-2 text-xs">
                        <Eye size={13} /> Publier
                      </button>
                    </form>
                  ) : (
                    <form action={changerStatutPostAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={POST_STATUS.BROUILLON} />
                      <button type="submit" className="btn-ghost px-3 py-2 text-xs">
                        <EyeOff size={13} /> Dépublier
                      </button>
                    </form>
                  )}
                  {p.status !== POST_STATUS.ARCHIVEE ? (
                    <form action={changerStatutPostAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={POST_STATUS.ARCHIVEE} />
                      <button type="submit" className="btn-ghost px-3 py-2 text-xs">
                        Archiver
                      </button>
                    </form>
                  ) : null}
                  <form action={dupliquerPostAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn-ghost px-3 py-2 text-xs">
                      <Copy size={13} /> Dupliquer
                    </button>
                  </form>
                  {p.imageUrl ? (
                    <form action={retirerImageAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="type" value="post" />
                      <button type="submit" className="btn-ghost px-3 py-2 text-xs">
                        Retirer le visuel
                      </button>
                    </form>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Disclosure variant="row" label="Modifier et prévisualiser">
                    <PostForm
                      post={{
                        id: p.id,
                        title: p.title,
                        subtitle: p.subtitle ?? '',
                        body: p.body,
                        price: p.price === null ? '' : String(p.price),
                        courseId: p.courseId ?? '',
                        sessionId: p.sessionId ?? '',
                        ctaLabel: p.ctaLabel ?? '',
                        ctaUrl: p.ctaUrl ?? '',
                        status: p.status,
                        publishedAt: jour(p.publishedAt),
                        expiresAt: jour(p.expiresAt),
                        sortOrder: p.sortOrder,
                        imageUrl: p.imageUrl,
                      }}
                      formations={options.formations}
                      sessions={options.sessions}
                    />
                  </Disclosure>
                  <form action={deletePostAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                      <Trash2 size={13} /> Supprimer
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
