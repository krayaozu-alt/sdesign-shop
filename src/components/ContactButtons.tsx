import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { whatsappLink } from '@/lib/utils';

/** Lien d'appel direct : sur smartphone il ouvre le composeur telephonique. */
export function callHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function CallButton({
  phone,
  label = 'Appeler',
  className,
  variant = 'ghost',
}: {
  phone: string;
  label?: string;
  className?: string;
  variant?: 'gold' | 'ghost' | 'outline';
}) {
  const cls = variant === 'gold' ? 'btn-gold' : variant === 'outline' ? 'btn-outline' : 'btn-ghost';
  return (
    <a href={callHref(phone)} className={cn(cls, className)} aria-label={`${label} le ${phone}`}>
      <Phone size={16} /> {label}
    </a>
  );
}

export function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp',
  className,
  variant = 'gold',
}: {
  phone: string;
  message?: string;
  label?: string;
  className?: string;
  variant?: 'gold' | 'ghost' | 'outline';
}) {
  const href = whatsappLink(phone, message);
  if (!href) return null;
  const cls = variant === 'gold' ? 'btn-gold' : variant === 'outline' ? 'btn-outline' : 'btn-ghost';
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(cls, className)}
      aria-label={`Écrire sur WhatsApp au ${phone}`}
    >
      <MessageCircle size={16} /> {label}
    </a>
  );
}

/**
 * Bloc de contact complet : numero principal (WhatsApp + appel) et second
 * numero reserve aux appels.
 */
export function ContactNumbers({
  phone,
  whatsapp,
  phone2,
  className,
}: {
  phone: string;
  whatsapp: string;
  phone2?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="surface p-4">
        <p className="label-eyebrow mb-2">WhatsApp / Appel</p>
        <p className="font-display text-xl text-cream">{phone}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <WhatsAppButton
            phone={whatsapp || phone}
            message="Bonjour S.DESIGN SHOP, je souhaite des informations."
            className="px-4 py-2 text-xs"
          />
          <CallButton phone={phone} label="Appeler" variant="outline" className="px-4 py-2 text-xs" />
        </div>
      </div>

      {phone2 ? (
        <div className="surface p-4">
          <p className="label-eyebrow mb-2">Appel</p>
          <p className="font-display text-xl text-cream">{phone2}</p>
          <div className="mt-3">
            <CallButton phone={phone2} label="Appeler" variant="outline" className="px-4 py-2 text-xs" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
