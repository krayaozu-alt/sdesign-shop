import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, CheckCircle2, Clock, GraduationCap, Layers, Users, Wallet } from 'lucide-react';
import { Badge, Card, Media, toneForStatus } from '@/components/ui/primitives';
import { COURSE_STATUS_LABELS, LEVEL_LABELS, type CourseStatus, type Level } from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { parseJsonArray } from '@/lib/utils';
import { appUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

async function getCourse(slug: string) {
  return prisma.course.findUnique({
    where: { slug },
    include: {
      trainer: true,
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
      modules: { orderBy: { orderIndex: 'asc' } },
      sessions: { orderBy: { startDate: 'asc' } },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const course = await getCourse(params.slug).catch(() => null);
  return {
    title: course?.name ?? 'Formation',
    alternates: { canonical: appUrl(`/formations/${params.slug}`) },
  };
}

export default async function CourseDetailPage({ params }: { params: { slug: string } }) {
  const course = await getCourse(params.slug);
  if (!course) notFound();

  const objectives = parseJsonArray(course.objectives);
  const requirements = parseJsonArray(course.requirements);
  const seatsLeft = Math.max(0, course.capacity - course._count.enrollments);

  return (
    <div className="container-page py-8">
      <Link href="/formations" className="mb-4 inline-block text-sm text-cream-muted hover:text-cream">
        ← Toutes les formations
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Media src={course.imageUrl} alt={course.name} label={course.name} ratio="aspect-[16/9]" className="mb-3" />

          {/* Autres visuels de la formation */}
          {course.images.length > 1 ? (
            <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {course.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={img.url}
                  alt={img.alt ?? course.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg border border-white/10 object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="mb-5" />
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone={toneForStatus(course.status)}>
              {COURSE_STATUS_LABELS[course.status as CourseStatus] ?? course.status}
            </Badge>
            <Badge>{course.category}</Badge>
            <Badge>{LEVEL_LABELS[course.level as Level] ?? course.level}</Badge>
          </div>

          <h1 className="font-display text-3xl text-cream sm:text-4xl">{course.name}</h1>
          <p className="mt-3 text-cream-muted">{course.description}</p>

          {objectives.length > 0 ? (
            <section className="mt-8">
              <h2 className="section-title mb-3 text-xl">Objectifs de la formation</h2>
              <ul className="space-y-2">
                {objectives.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-sm text-cream-muted">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold-400" />
                    {o}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {course.modules.length > 0 ? (
            <section className="mt-8">
              <h2 className="section-title mb-3 text-xl">Programme détaillé</h2>
              <ol className="space-y-2">
                {course.modules.map((m, i) => (
                  <li key={m.id} className="surface flex items-start gap-3 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-night-900">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm text-cream">{m.title}</p>
                      {m.description ? <p className="mt-1 text-xs text-cream-muted">{m.description}</p> : null}
                      {m.durationHours > 0 ? (
                        <p className="mt-1 text-[11px] text-cream-dim">{m.durationHours} h</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {course.sessions.length > 0 ? (
            <section className="mt-8">
              <h2 className="section-title mb-3 text-xl">Calendrier des sessions</h2>
              <div className="space-y-2">
                {course.sessions.map((s) => (
                  <div key={s.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm text-cream">{s.title}</p>
                      <p className="text-xs text-cream-muted">
                        {formatDate(s.startDate)} → {formatDate(s.endDate)}
                        {s.location ? ` — ${s.location}` : ''}
                      </p>
                    </div>
                    <Badge tone={toneForStatus(s.status)}>{s.status}</Badge>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {requirements.length > 0 ? (
            <section className="mt-8">
              <h2 className="section-title mb-3 text-xl">Conditions d’inscription</h2>
              <ul className="space-y-2">
                {requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-cream-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Carte laterale : prix, informations cles, inscription */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card strong className="p-6">
            <p className="label-eyebrow mb-1">Tarif de la formation</p>
            <p className="font-display text-3xl text-gold-300">{formatMoney(course.price)}</p>
            {course.depositAmount > 0 ? (
              <p className="mt-1 text-xs text-cream-muted">
                Acompte conseillé à l’inscription : {formatMoney(course.depositAmount)}
              </p>
            ) : null}

            <div className="my-5 gold-rule" />

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Clock size={16} className="text-gold-400" />
                <span className="text-cream-muted">Durée</span>
                <span className="ml-auto text-cream">{course.durationLabel}</span>
              </li>
              <li className="flex items-center gap-3">
                <Layers size={16} className="text-gold-400" />
                <span className="text-cream-muted">Volume</span>
                <span className="ml-auto text-cream">{course.durationHours} h</span>
              </li>
              <li className="flex items-center gap-3">
                <GraduationCap size={16} className="text-gold-400" />
                <span className="text-cream-muted">Niveau</span>
                <span className="ml-auto text-cream">{LEVEL_LABELS[course.level as Level] ?? course.level}</span>
              </li>
              <li className="flex items-center gap-3">
                <Users size={16} className="text-gold-400" />
                <span className="text-cream-muted">Places restantes</span>
                <span className="ml-auto text-cream">
                  {seatsLeft} / {course.capacity}
                </span>
              </li>
              {course.startDate ? (
                <li className="flex items-center gap-3">
                  <CalendarDays size={16} className="text-gold-400" />
                  <span className="text-cream-muted">Début</span>
                  <span className="ml-auto text-cream">{formatDate(course.startDate)}</span>
                </li>
              ) : null}
              <li className="flex items-center gap-3">
                <Wallet size={16} className="text-gold-400" />
                <span className="text-cream-muted">Formatrice</span>
                <span className="ml-auto text-cream">{course.trainer?.fullName ?? 'À définir'}</span>
              </li>
            </ul>

            <div className="mt-6">
              {seatsLeft > 0 ? (
                <Link href={`/formations/${course.slug}/inscription`} className="btn-gold w-full">
                  S’INSCRIRE À LA FORMATION
                </Link>
              ) : (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-100">
                  Formation complète — contactez-nous pour la prochaine session.
                </div>
              )}
              <Link href="/contact" className="btn-ghost mt-2 w-full">
                Poser une question
              </Link>
            </div>
          </Card>

          {course.trainer ? (
            <Card className="mt-4">
              <p className="label-eyebrow mb-2">Votre formatrice</p>
              <div className="flex items-center gap-3">
                <Media
                  src={course.trainer.photoUrl}
                  alt={course.trainer.fullName}
                  label={course.trainer.fullName}
                  ratio="aspect-square"
                  className="w-14 rounded-full"
                />
                <div>
                  <p className="text-sm text-cream">{course.trainer.fullName}</p>
                  <p className="text-xs text-cream-muted">{course.trainer.speciality}</p>
                </div>
              </div>
              {course.trainer.bio ? <p className="mt-3 text-xs text-cream-muted">{course.trainer.bio}</p> : null}
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
