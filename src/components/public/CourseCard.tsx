import Link from 'next/link';
import { Clock, GraduationCap, Users } from 'lucide-react';
import { Media } from '@/components/ui/primitives';
import { LEVEL_LABELS, type Level } from '@/lib/constants';
import { formatMoney } from '@/lib/format';

export type CourseCardData = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  imageUrl: string | null;
  price: number;
  durationLabel: string;
  level: string;
  capacity: number;
  enrolled: number;
};

/**
 * Carte de formation du site public : grande photo, nom, description courte,
 * prix bien visible, duree, niveau et les deux actions.
 */
export function CourseCard({ course }: { course: CourseCardData }) {
  const seatsLeft = Math.max(0, course.capacity - course.enrolled);
  const full = seatsLeft === 0;

  return (
    <article className="surface group flex flex-col overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/formations/${course.slug}`} className="relative block">
        <Media
          src={course.imageUrl}
          alt={course.name}
          label={course.name}
          ratio="aspect-[4/3]"
          className="rounded-none transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Prix : lisible d'un coup d'oeil, pose sur la photo */}
        <span className="absolute bottom-3 left-3 rounded-pill bg-gold-gradient px-3 py-1.5 text-sm font-bold text-night-900 shadow-gold">
          {formatMoney(course.price)}
        </span>
        {full ? (
          <span className="absolute right-3 top-3 rounded-pill border border-amber-300/40 bg-night-950/85 px-3 py-1 text-[11px] font-medium text-amber-200">
            Complète
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl leading-tight text-cream">
          <Link href={`/formations/${course.slug}`} className="transition-colors hover:text-gold-200">
            {course.name}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 flex-1 text-sm text-cream-muted">{course.shortDescription}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-cream-dim">
          <span className="flex items-center gap-1.5">
            <Clock size={12} className="text-gold-400" /> {course.durationLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap size={12} className="text-gold-400" /> {LEVEL_LABELS[course.level as Level] ?? course.level}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={12} className="text-gold-400" /> {seatsLeft} place{seatsLeft > 1 ? 's' : ''}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/formations/${course.slug}`} className="btn-ghost flex-1 px-3 py-2.5 text-xs">
            Voir la formation
          </Link>
          {full ? (
            <Link href="/contact" className="btn-outline flex-1 px-3 py-2.5 text-xs">
              Nous contacter
            </Link>
          ) : (
            <Link href={`/formations/${course.slug}/inscription`} className="btn-gold flex-1 px-3 py-2.5 text-xs">
              S’inscrire
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
