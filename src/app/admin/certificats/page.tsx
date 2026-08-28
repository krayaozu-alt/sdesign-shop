import Link from 'next/link';
import { Award } from 'lucide-react';
import { CertificateForm } from '@/components/admin/FinanceForms';
import { Badge, Card, DataTable, EmptyState, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { formatDateShort } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { revokeCertificateAction } from '@/server/actions/finance';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Certificats' };
export const dynamic = 'force-dynamic';

export default async function AdminCertificatesPage() {
  await requirePermission('certificates.manage');
  const [certificates, eligible, settings] = await Promise.all([
    prisma.certificate.findMany({ orderBy: { issuedAt: 'desc' }, take: 300 }),
    prisma.enrollment.findMany({
      where: { status: 'TERMINEE', certificate: { is: null } },
      include: { student: { include: { user: { select: { fullName: true } } } }, course: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
    }),
    getSettings(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Reconnaissance</p>
        <h1 className="section-title">Certificats</h1>
      </div>

      <Disclosure label={<><Award size={15} /> Générer un certificat</>}>
        <CertificateForm
          enrollments={eligible.map((e) => ({
            id: e.id,
            label: `${e.student.user.fullName} — ${e.course.name} (${e.reference})`,
          }))}
          defaultSignedBy={settings['shop.director']}
        />
      </Disclosure>

      {certificates.length === 0 ? (
        <EmptyState
          icon={<Award size={28} />}
          title="Aucun certificat délivré"
          description="Terminez une formation puis générez le certificat : numéro unique et QR code de vérification inclus."
        />
      ) : (
        <DataTable head={['Numéro', 'Titulaire', 'Formation', 'Durée', 'Délivré le', 'Code', 'Statut', '']}>
          {certificates.map((c) => (
            <tr key={c.id}>
              <Td className="whitespace-nowrap text-cream">{c.number}</Td>
              <Td>{c.studentName}</Td>
              <Td>{c.courseName}</Td>
              <Td className="whitespace-nowrap">{c.durationLabel}</Td>
              <Td className="whitespace-nowrap">{formatDateShort(c.issuedAt)}</Td>
              <Td className="whitespace-nowrap font-mono text-xs text-gold-300">{c.verificationCode}</Td>
              <Td>
                <Badge tone={toneForStatus(c.status)}>{c.status === 'VALIDE' ? 'Valide' : 'Révoqué'}</Badge>
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <Link href={`/certificat/${c.number}`} className="btn-ghost px-3 py-1.5 text-xs">
                    Imprimer
                  </Link>
                  <form action={revokeCertificateAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value={c.status === 'VALIDE' ? 'REVOQUE' : 'VALIDE'} />
                    <button
                      type="submit"
                      className={c.status === 'VALIDE' ? 'btn-danger px-3 py-1.5 text-xs' : 'btn-outline px-3 py-1.5 text-xs'}
                    >
                      {c.status === 'VALIDE' ? 'Révoquer' : 'Rétablir'}
                    </button>
                  </form>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Card className="text-xs text-cream-muted">
        Chaque certificat porte un numéro unique et un code de vérification publiquement contrôlable sur{' '}
        <Link href="/verifier" className="text-gold-300 hover:text-gold-200">
          /verifier
        </Link>{' '}
        — le QR code imprimé pointe vers cette page.
      </Card>
    </div>
  );
}
