import { cn } from '@/lib/utils';

/** Indicateur d'etapes dore, utilise par les parcours d'inscription et de reservation. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-between gap-1">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span className={cn('h-px flex-1', i === 0 ? 'opacity-0' : done || active ? 'bg-gold-500/60' : 'bg-white/10')} />
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition',
                  active
                    ? 'border-transparent bg-gold-gradient text-night-900'
                    : done
                      ? 'border-gold-500/50 bg-gold-500/15 text-gold-300'
                      : 'border-white/12 bg-white/5 text-cream-dim',
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'h-px flex-1',
                  i === steps.length - 1 ? 'opacity-0' : done ? 'bg-gold-500/60' : 'bg-white/10',
                )}
              />
            </div>
            <span className={cn('text-center text-[10px] leading-tight', active ? 'text-gold-300' : 'text-cream-dim')}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
