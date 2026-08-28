import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Award,
  BadgeCheck,
  CalendarCheck,
  CalendarRange,
  GraduationCap,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Phone,
  Quote,
  Sparkles,
  Star,
  UserCheck,
} from 'lucide-react';
import { CallButton, WhatsAppButton } from '@/components/ContactButtons';
import { CourseCard } from '@/components/public/CourseCard';
import { SessionCard, periodeLisible, versCarte } from '@/components/public/SessionCard';
import { Logo } from '@/components/layout/Logo';
import { Badge, Card, Media, SectionHeader, SeeAllLink } from '@/components/ui/primitives';
import { COURSE_STATUS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/format';
import { prochainesSessions } from '@/server/sessions';
import { bannieresActives, publicationsActives } from '@/server/marketing';
import { AnnonceCarte, AnnonceLarge, versAnnonce } from '@/components/public/Annonce';
import { Hero } from '@/components/public/Hero';
import { BANNER_PLACEMENTS } from '@/lib/constants';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';
import { appUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

// L'accueil herite du titre, de la description et de la carte de partage
// posee dans le layout racine. Seule l'adresse canonique lui est propre.
export const metadata: Metadata = { alternates: { canonical: appUrl('/') } };

const ADVANTAGES = [
  {
    icon: Award,
    title: 'Formation de qualité',
    text: 'Des programmes structurés, un encadrement professionnel et du matériel adapté.',
  },
  {
    icon: HeartHandshake,
    title: 'Accompagnement personnalisé',
    text: 'Un suivi individuel de votre progression du premier jour jusqu’à la certification.',
  },
  {
    icon: UserCheck,
    title: 'Formatrices expérimentées',
    text: 'Des professionnelles reconnues du métier, à l’écoute et exigeantes.',
  },
  {
    icon: BadgeCheck,
    title: 'Certification reconnue',
    text: 'Un certificat authentifiable par QR code remis à la fin de chaque formation.',
  },
  {
    icon: Sparkles,
    title: 'Résultats professionnels',
    text: 'Des techniques directement applicables pour lancer ou développer votre activité.',
  },
];

export default async function HomePage() {
  const settings = await getSettings();

  const [courses, services, gallery, testimonials, stats, sessions, bannieresHero, publications, bannieresAccueil, bannieresMilieu] =
    await Promise.all([
    prisma.course.findMany({
      where: { status: { in: [COURSE_STATUS.OUVERTE, COURSE_STATUS.EN_COURS, COURSE_STATUS.COMPLETE] } },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      take: 6,
      include: { _count: { select: { enrollments: true } } },
    }),
    prisma.service.findMany({
      where: { isAvailable: true },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      take: 8,
    }),
    prisma.galleryItem.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 6,
    }),
    prisma.testimonial.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 3 }),
    Promise.all([
      prisma.course.count({ where: { status: { not: COURSE_STATUS.ARCHIVEE } } }),
      prisma.student.count(),
      prisma.certificate.count({ where: { status: 'VALIDE' } }),
    ]),
    // Sessions visibles du public, deja triees par date de debut.
    prochainesSessions(6),
    bannieresActives(BANNER_PLACEMENTS.HERO, 1),
    publicationsActives(3),
    bannieresActives(BANNER_PLACEMENTS.ACCUEIL, 2),
    bannieresActives(BANNER_PLACEMENTS.MILIEU, 2),
  ]);

  /**
   * « A la une » : une seule mise en avant, choisie dans un ordre de priorite
   * strict et jamais aleatoire —
   *   1. banniere de l'emplacement HERO en cours de diffusion ;
   *   2. a defaut, la publication active la mieux classee ;
   *   3. a defaut, la session ouverte la plus proche.
   * Si rien ne correspond, la section n'est pas affichee du tout.
   *
   * La publication retenue ici est retiree de la liste plus bas : le meme
   * contenu ne doit jamais apparaitre deux fois sur la page.
   */
  const banniereHero = bannieresHero[0] ?? null;
  const publicationVedette = !banniereHero ? (publications[0] ?? null) : null;
  const sessionVedette =
    !banniereHero && !publicationVedette ? (sessions.find((s) => s.etat.inscriptionPossible) ?? null) : null;

  const publicationsSecondaires = publicationVedette ? publications.slice(1) : publications;

  const [courseCount, studentCount, certificateCount] = stats;

  return (
    <>
      {/* ------------------------------------------------------------- HERO */}
      <Hero
        slogan={settings['shop.slogan']}
        tagline={settings['shop.tagline']}
        photoUrl={settings['hero.imageUrl'] || null}
      />

      {/* Chiffres reels issus de la base, sous le hero */}
      <section className="container-page -mt-2 sm:mt-2">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3">
          {[
            { value: courseCount, label: 'Formations' },
            { value: studentCount, label: 'Élèves formées' },
            { value: certificateCount, label: 'Certificats délivrés' },
          ].map((s) => (
            <div key={s.label} className="surface lift px-3 py-4 text-center">
              <p className="font-display text-2xl text-gold-300">{s.value}</p>
              <p className="mt-1 text-[11px] text-cream-dim">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- À LA UNE */}
      {banniereHero || publicationVedette || sessionVedette ? (
        <section className="container-page mt-12">
          {banniereHero ? (
            <AnnonceLarge annonce={versAnnonce(banniereHero)} etiquette="À la une" />
          ) : publicationVedette ? (
            <AnnonceLarge annonce={versAnnonce(publicationVedette)} etiquette="À la une" />
          ) : sessionVedette ? (
            <AnnonceLarge
              annonce={{
                titre: sessionVedette.course.name,
                sousTitre: 'Prochaine session',
                texte: sessionVedette.title,
                photo: sessionVedette.photo,
                prix: sessionVedette.prix,
                lien: `/formations/${sessionVedette.course.slug}/inscription?session=${sessionVedette.slug}`,
                libelleBouton: 'S’inscrire',
                formationNom: null,
                periode: { debut: sessionVedette.startDate, fin: sessionVedette.endDate },
                places: sessionVedette.etat,
              }}
              etiquette="À la une"
            />
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------------------------ AUTRES PUBLICATIONS */}
      {publicationsSecondaires.length > 0 || bannieresAccueil.length > 0 ? (
        <section className="container-page mt-12">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bannieresAccueil.map((b) => (
              <AnnonceCarte key={`b-${b.id}`} annonce={versAnnonce(b)} />
            ))}
            {publicationsSecondaires.map((p) => (
              <AnnonceCarte key={`p-${p.id}`} annonce={versAnnonce(p)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- PROCHAINES FORMATIONS */}
      <section className="container-page mt-14">
        <SectionHeader
          eyebrow="Nos prochaines dates"
          title="Prochaines formations"
          action={<SeeAllLink href="/calendrier-formations" label="Voir le calendrier" />}
        />
        {sessions.length === 0 ? (
          <Card className="text-center">
            <p className="mb-3 text-sm text-cream-muted">
              Aucune prochaine formation n’est programmée pour le moment.
            </p>
            <Link href="/formations" className="btn-outline px-4 py-2 text-xs">
              Découvrir nos formations
            </Link>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.slug} session={versCarte(s)} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- BANNIÈRE MILIEU */}
      {bannieresMilieu.length > 0 ? (
        <section className="container-page mt-12 space-y-5">
          {bannieresMilieu.map((b) => (
            <AnnonceLarge key={b.id} annonce={versAnnonce(b)} />
          ))}
        </section>
      ) : null}

      {/* ------------------------------------------------------- ACCÈS RAPIDE */}
      <section className="container-page">
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/formations', icon: GraduationCap, t1: 'Formations', t2: 'Professionnelles' },
            { href: '/prestations', icon: Sparkles, t1: 'Prestations', t2: 'Beauté' },
            { href: '/reservation', icon: CalendarCheck, t1: 'Réservations', t2: 'Faciles' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="surface card-hover flex flex-col items-center gap-2 p-4 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                  <Icon size={20} />
                </span>
                <span className="text-xs font-medium leading-tight text-cream">
                  {item.t1}
                  <br />
                  <span className="text-cream-muted">{item.t2}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------- FORMATIONS POPULAIRES */}
      <section className="container-page mt-14">
        <SectionHeader
          eyebrow="Notre catalogue"
          title="Formations populaires"
          action={<SeeAllLink href="/formations" />}
        />
        {courses.length === 0 ? (
          <Card className="text-center text-sm text-cream-muted">
            Aucune formation publiée pour le moment. Les formations ajoutées depuis l’administration apparaîtront ici.
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={{
                  id: course.id,
                  slug: course.slug,
                  name: course.name,
                  shortDescription: course.shortDescription,
                  imageUrl: course.imageUrl,
                  price: course.price,
                  durationLabel: course.durationLabel,
                  level: course.level,
                  capacity: course.capacity,
                  enrolled: course._count.enrollments,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- PRESTATIONS */}
      <section className="container-page mt-14">
        <SectionHeader eyebrow="Institut" title="Nos prestations" action={<SeeAllLink href="/prestations" />} />
        {services.length === 0 ? (
          <Card className="text-center text-sm text-cream-muted">
            Aucune prestation publiée pour le moment.
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {services.map((service) => (
              <Link key={service.id} href={`/prestations/${service.slug}`} className="group flex flex-col items-center gap-2 text-center">
                <Media
                  src={service.imageUrl}
                  alt={service.name}
                  label={service.name}
                  ratio="aspect-square"
                  className="w-full rounded-full ring-1 ring-gold-500/20 transition group-hover:ring-gold-500/60"
                />
                <span className="text-[11px] leading-tight text-cream-muted group-hover:text-cream">{service.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ POURQUOI */}
      <section className="container-page mt-16">
        <SectionHeader eyebrow="Notre engagement" title={`Pourquoi choisir ${settings['shop.name']} ?`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADVANTAGES.map((a) => {
            const Icon = a.icon;
            return (
              <Card key={a.title} className="card-hover">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                  <Icon size={20} />
                </span>
                <h3 className="font-display text-lg text-cream">{a.title}</h3>
                <p className="mt-1.5 text-sm text-cream-muted">{a.text}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------- GALERIE */}
      <section className="container-page mt-16">
        <SectionHeader eyebrow="Nos réalisations" title="Galerie" action={<SeeAllLink href="/galerie" />} />
        {gallery.length === 0 ? (
          <Card className="text-center text-sm text-cream-muted">
            La galerie sera enrichie depuis l’administration.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((item) => (
              <div key={item.id} className="surface overflow-hidden p-0">
                <Media src={item.url} alt={item.title} label={item.title} ratio="aspect-square" />
                <div className="px-3 py-2">
                  <p className="truncate text-xs text-cream">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- TÉMOIGNAGES */}
      {testimonials.length > 0 ? (
        <section className="container-page mt-16">
          <SectionHeader eyebrow="Elles nous font confiance" title="Témoignages" />
          <div className="grid gap-4 sm:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.id} className="flex flex-col">
                <Quote size={22} className="mb-3 text-gold-400/70" />
                <p className="flex-1 text-sm italic text-cream-muted">« {t.message} »</p>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cream">{t.authorName}</p>
                    <p className="text-[11px] text-cream-dim">{t.role}</p>
                  </div>
                  <div className="flex gap-0.5 text-gold-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} size={12} fill="currentColor" />
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------------------- CONTACT */}
      <section className="container-page mt-16">
        <div className="surface-strong overflow-hidden p-0">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="p-7">
              <p className="label-eyebrow mb-2">Nous joindre</p>
              <h2 className="section-title mb-4">Contact</h2>
              <ul className="space-y-3 text-sm text-cream-muted">
                <li className="flex items-start gap-3">
                  <MessageCircle size={16} className="mt-0.5 text-gold-400" />
                  <span>
                    <span className="block text-[11px] uppercase tracking-wider text-cream-dim">WhatsApp / Appel</span>
                    <span className="text-cream">{settings['shop.phone']}</span>
                  </span>
                </li>
                {settings['shop.phone2'] ? (
                  <li className="flex items-start gap-3">
                    <Phone size={16} className="mt-0.5 text-gold-400" />
                    <span>
                      <span className="block text-[11px] uppercase tracking-wider text-cream-dim">Appel</span>
                      <span className="text-cream">{settings['shop.phone2']}</span>
                    </span>
                  </li>
                ) : null}
                <li className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 text-gold-400" />
                  <span>{settings['shop.address']}</span>
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">
                <WhatsAppButton
                  phone={settings['shop.whatsapp'] || settings['shop.phone']}
                  message={`Bonjour ${settings['shop.name']}, je souhaite des informations.`}
                />
                <CallButton phone={settings['shop.phone']} variant="outline" />
                {settings['shop.phone2'] ? (
                  <CallButton phone={settings['shop.phone2']} label={settings['shop.phone2']} variant="ghost" />
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/contact" className="btn-ghost px-4 py-2 text-xs">
                  Page contact
                </Link>
                <Link href="/reservation" className="btn-ghost px-4 py-2 text-xs">
                  Réserver une prestation
                </Link>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-white/10 p-7 sm:border-l sm:border-t-0">
              <Badge tone="gold">Horaires d’ouverture</Badge>
              <p className="whitespace-pre-line text-sm text-cream-muted">{settings['shop.hours']}</p>
              <p className="mt-2 text-xs text-cream-dim">
                Vous pouvez également vérifier l’authenticité d’un certificat depuis la page{' '}
                <Link href="/verifier" className="text-gold-300 hover:text-gold-200">
                  Vérification
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
