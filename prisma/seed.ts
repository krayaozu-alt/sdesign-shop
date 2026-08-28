/**
 * Donnees officielles de S.DESIGN SHOP.
 *
 * Ce script installe le catalogue OFFICIEL (formations, prix, coordonnees)
 * communique par la direction. Il ne cree aucune donnee fictive : ni eleve, ni
 * cliente, ni reservation, ni paiement, ni certificat. Ces enregistrements
 * proviennent uniquement de l'usage reel de l'application.
 *
 * Les prix ci-dessous sont les PRIX OFFICIELS. L'administrateur peut les
 * modifier a tout moment depuis Admin > Formations ; relancer ce script
 * (npm run db:seed) restaure les valeurs officielles.
 *
 * Execution : npm run db:seed  (idempotent, relançable sans doublon)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------- COORDONNEES OFFICIELLES */

const SETTINGS: { key: string; value: string; group: string; label: string; type: string }[] = [
  { key: 'shop.name', value: 'S.DESIGN SHOP', group: 'IDENTITE', label: "Nom de l'établissement", type: 'TEXT' },
  { key: 'shop.tagline', value: 'Beauté • Formation • Élégance', group: 'IDENTITE', label: 'Signature', type: 'TEXT' },
  {
    key: 'shop.slogan',
    value: 'Révélez votre beauté, développez votre talent.',
    group: 'IDENTITE',
    label: 'Phrase marketing',
    type: 'TEXT',
  },
  { key: 'shop.logoUrl', value: '', group: 'IDENTITE', label: 'Logo', type: 'IMAGE' },
  { key: 'shop.director', value: 'La Direction', group: 'IDENTITE', label: 'Signataire des certificats', type: 'TEXT' },

  // Numero principal : WhatsApp + appels
  { key: 'shop.phone', value: '+226 76 51 88 11', group: 'CONTACT', label: 'Téléphone principal (WhatsApp + appels)', type: 'TEXT' },
  { key: 'shop.whatsapp', value: '+226 76 51 88 11', group: 'CONTACT', label: 'Numéro WhatsApp', type: 'TEXT' },
  // Second numero : appels uniquement
  { key: 'shop.phone2', value: '+226 62 71 30 19', group: 'CONTACT', label: 'Second numéro (appels uniquement)', type: 'TEXT' },

  { key: 'shop.email', value: 'contact@sdesignshop.com', group: 'CONTACT', label: 'Email', type: 'TEXT' },
  { key: 'shop.address', value: 'Ouagadougou, Burkina Faso', group: 'LOCALISATION', label: 'Adresse affichée', type: 'TEXT' },
  { key: 'shop.city', value: 'Ouagadougou', group: 'LOCALISATION', label: 'Ville', type: 'TEXT' },
  { key: 'shop.district', value: 'Marcoussi', group: 'LOCALISATION', label: 'Quartier / zone', type: 'TEXT' },
  { key: 'shop.country', value: 'Burkina Faso', group: 'LOCALISATION', label: 'Pays', type: 'TEXT' },
  { key: 'shop.latitude', value: '12.40567398071289', group: 'LOCALISATION', label: 'Latitude', type: 'TEXT' },
  { key: 'shop.longitude', value: '-1.6069070100784302', group: 'LOCALISATION', label: 'Longitude', type: 'TEXT' },
  { key: 'shop.mapUrl', value: 'https://maps.google.com/maps?q=12.40567398071289%2C-1.6069070100784302&z=17&hl=fr', group: 'LOCALISATION', label: 'Lien Google Maps', type: 'TEXT' },
  {
    key: 'shop.hours',
    value: 'Lundi - Samedi : 08h00 - 18h00\nDimanche : sur rendez-vous',
    group: 'CONTACT',
    label: 'Horaires',
    type: 'TEXTAREA',
  },
  { key: 'shop.facebook', value: '', group: 'RESEAUX', label: 'Facebook', type: 'TEXT' },
  { key: 'shop.instagram', value: '', group: 'RESEAUX', label: 'Instagram', type: 'TEXT' },
  { key: 'shop.tiktok', value: '', group: 'RESEAUX', label: 'TikTok', type: 'TEXT' },
  {
    key: 'payments.methods',
    value: 'ESPECES,ORANGE_MONEY,MOOV_MONEY,WAVE',
    group: 'PAIEMENT',
    label: 'Méthodes actives',
    type: 'TEXT',
  },
  {
    key: 'booking.slots',
    value: '08:00,09:00,10:00,11:00,12:00,14:00,15:00,16:00,17:00,18:00',
    group: 'RESERVATION',
    label: 'Créneaux',
    type: 'TEXT',
  },
  { key: 'booking.leadDays', value: '0', group: 'RESERVATION', label: 'Délai minimum (jours)', type: 'NUMBER' },
  {
    key: 'certificate.footer',
    value:
      "Ce certificat atteste de la participation et de la réussite de la formation suivie au sein de S.DESIGN SHOP.",
    group: 'CERTIFICAT',
    label: 'Mention certificat',
    type: 'TEXTAREA',
  },
];

/* ------------------------------------------------------- FORMATIONS OFFICIELLES */

type CourseSeed = {
  name: string;
  category: string;
  /** PRIX OFFICIEL en FCFA. Ne pas modifier sans accord de la direction. */
  price: number;
  durationLabel: string;
  durationHours: number;
  level: string;
  capacity: number;
  featured: boolean;
  shortDescription: string;
  description: string;
  objectives: string[];
  requirements: string[];
  modules: string[];
};

const OFFICIAL_COURSES: CourseSeed[] = [
  {
    name: 'Coiffe simple',
    category: 'Coiffe',
    price: 25000,
    durationLabel: '2 semaines',
    durationHours: 60,
    level: 'DEBUTANT',
    capacity: 12,
    featured: true,
    shortDescription: 'Maîtrisez les coiffes du quotidien : rapidité, propreté et tenue impeccable.',
    description:
      "Formation d'initiation aux coiffes simples : préparation du cheveu, sections nettes, tensions maîtrisées et finitions soignées. C'est la base indispensable avant toute spécialisation.",
    objectives: [
      'Préparer et assainir le cheveu avant la coiffe',
      'Réaliser des sections nettes et régulières',
      'Maîtriser la tension pour une tenue durable',
      'Soigner les finitions et le rendu final',
    ],
    requirements: ['Aucun prérequis'],
    modules: [
      'Hygiène, matériel et préparation du cheveu',
      'Sections et lignes de partage',
      'Techniques de base',
      'Finitions et entretien',
    ],
  },
  {
    name: 'Coiffe sénégalais',
    category: 'Coiffe',
    price: 25000,
    durationLabel: '3 semaines',
    durationHours: 80,
    level: 'INTERMEDIAIRE',
    capacity: 10,
    featured: true,
    shortDescription: 'La technique sénégalaise complète : torsades, rajouts et finitions professionnelles.',
    description:
      "Formation à la coiffe sénégalaise. Vous apprenez la pose des rajouts, la régularité des torsades, la gestion du volume et les finitions qui font la différence en salon.",
    objectives: [
      'Poser des rajouts proprement et durablement',
      'Réaliser des torsades régulières',
      'Gérer volume, longueur et symétrie',
      'Conseiller la cliente sur l’entretien',
    ],
    requirements: ['Notions de base en coiffure recommandées'],
    modules: [
      'Diagnostic capillaire et préparation',
      'Pose des rajouts',
      'Torsades et régularité',
      'Finitions, entretien et conseil client',
    ],
  },
  {
    name: 'Coiffe nigérienne',
    category: 'Coiffe',
    price: 45000,
    durationLabel: '3 semaines',
    durationHours: 90,
    level: 'INTERMEDIAIRE',
    capacity: 10,
    featured: true,
    shortDescription: 'Les tressages et motifs de la coiffe nigérienne, du classique au créatif.',
    description:
      'Formation dédiée aux techniques nigériennes : motifs géométriques, tressages serrés et compositions créatives adaptées aux occasions comme au quotidien.',
    objectives: [
      'Reproduire les motifs traditionnels',
      'Maîtriser les tressages serrés sans casser le cheveu',
      'Créer des compositions personnalisées',
    ],
    requirements: ['Notions de base en coiffure recommandées'],
    modules: ['Motifs et repères', 'Tressage serré maîtrisé', 'Compositions créatives', 'Finitions et durabilité'],
  },
  {
    name: 'Éventail',
    category: 'Éventail',
    price: 35000,
    durationLabel: '1 semaine',
    durationHours: 30,
    level: 'DEBUTANT',
    capacity: 12,
    featured: true,
    shortDescription: 'Confection et décoration d’éventails de cérémonie.',
    description:
      "Formation à la confection d'éventails décoratifs pour mariages et cérémonies : montage de la structure, habillage, décoration et personnalisation selon le thème.",
    objectives: ['Monter la structure', 'Habiller et décorer', 'Personnaliser selon le thème'],
    requirements: ['Aucun prérequis'],
    modules: ['Matériaux et montage', 'Habillage et décoration', 'Personnalisation'],
  },
  {
    name: 'Turban marié',
    category: 'Turban',
    price: 30000,
    durationLabel: '1 semaine',
    durationHours: 30,
    level: 'TOUS',
    capacity: 12,
    featured: true,
    shortDescription: 'L’art du turban de cérémonie : structure, drapés et maintien parfait.',
    description:
      "Formation spécialisée dans le turban de mariée et de cérémonie : choix des tissus, construction de la structure, drapés symétriques et maintien longue durée pour les grandes occasions.",
    objectives: [
      'Choisir et préparer les tissus',
      'Construire une base stable et confortable',
      'Réaliser des drapés symétriques',
      'Assurer un maintien longue durée',
    ],
    requirements: ['Aucun prérequis'],
    modules: ['Tissus et accessoires', 'Bases et structures', 'Drapés de cérémonie', 'Finitions et pose sur modèle'],
  },
  {
    name: 'Turban à la machine',
    category: 'Turban',
    price: 60000,
    durationLabel: '1 mois',
    durationHours: 120,
    level: 'INTERMEDIAIRE',
    capacity: 10,
    featured: true,
    shortDescription: 'La confection de turbans à la machine : couture, structure et finitions.',
    description:
      "Formation professionnelle à la confection de turbans à la machine : prise de mesures, coupe, assemblage à la machine, structure interne et finitions haut de gamme prêtes à la vente.",
    objectives: [
      'Prendre les mesures et couper proprement',
      'Assembler à la machine avec régularité',
      'Structurer le turban pour un maintien durable',
      'Réaliser des finitions de qualité marchande',
    ],
    requirements: ['Notions de couture recommandées'],
    modules: [
      'Machine, sécurité et matériaux',
      'Prise de mesures et coupe',
      'Assemblage et structure',
      'Finitions et contrôle qualité',
    ],
  },
  {
    name: 'Voile',
    category: 'Voile',
    price: 40000,
    durationLabel: '2 semaines',
    durationHours: 50,
    level: 'DEBUTANT',
    capacity: 12,
    featured: true,
    shortDescription: 'Pose et stylisme des voiles pour toutes les occasions.',
    description:
      'Formation à la pose des voiles : maintien, harmonisation avec la tenue et la morphologie du visage, et variantes de style pour les cérémonies.',
    objectives: ['Maîtriser les poses classiques', 'Harmoniser voile, tenue et morphologie', 'Assurer un maintien sûr'],
    requirements: ['Aucun prérequis'],
    modules: ['Matières et accessoires', 'Poses classiques', 'Variantes de cérémonie', 'Finitions'],
  },
  {
    name: 'Maquillage',
    category: 'Maquillage',
    price: 25000,
    durationLabel: '2 semaines',
    durationHours: 55,
    level: 'DEBUTANT',
    capacity: 12,
    featured: true,
    shortDescription: 'Teint parfait, regard intense : le maquillage jour, soirée et mariée.',
    description:
      'Formation de maquillage professionnel : analyse du visage, préparation de la peau, correction du teint, mise en valeur du regard et maquillage de mariée longue tenue.',
    objectives: [
      'Analyser le visage et la carnation',
      'Préparer la peau et unifier le teint',
      'Réaliser un maquillage jour et soirée',
      'Réaliser un maquillage de mariée longue tenue',
    ],
    requirements: ['Aucun prérequis'],
    modules: [
      'Hygiène, matériel et pinceaux',
      'Préparation de la peau et teint',
      'Yeux, sourcils et lèvres',
      'Maquillage jour et soirée',
      'Maquillage mariée longue tenue',
    ],
  },
];

/* ------------------------------------------------------------------ PRESTATIONS */

/**
 * Catalogue de prestations de l'institut. Aucun tarif officiel n'ayant ete
 * communique, le prix est laisse a 0 : l'application affiche alors
 * « Sur demande ». L'administrateur saisit les tarifs reels depuis
 * Admin > Prestations. Le prix n'est ecrit qu'a la creation : une relance du
 * seed n'ecrase jamais un tarif saisi par la boutique.
 */
const SERVICES: { name: string; category: string; description: string; duration: number; featured: boolean }[] = [
  { name: 'Coiffure', category: 'Coiffures', description: 'Coiffure sur mesure réalisée par nos professionnelles.', duration: 120, featured: true },
  { name: 'Maquillage', category: 'Maquillage', description: 'Maquillage jour, soirée ou événement, adapté à votre carnation.', duration: 60, featured: true },
  { name: 'Onglerie', category: 'Onglerie', description: 'Pose gel, capsules et nail art pour des ongles parfaits.', duration: 90, featured: true },
  { name: 'Manucure', category: 'Manucure', description: 'Soin complet des mains : limage, cuticules, massage et vernis.', duration: 45, featured: true },
  { name: 'Pédicure', category: 'Pédicure', description: 'Soin complet des pieds : gommage, ponçage, massage et vernis.', duration: 60, featured: true },
  { name: 'Turban mariée', category: 'Turban mariée', description: 'Turban de cérémonie monté sur mesure pour votre grand jour.', duration: 60, featured: true },
  { name: 'Voiles', category: 'Voiles', description: 'Pose et stylisme de voiles pour cérémonies et événements.', duration: 45, featured: true },
  { name: 'Éventails', category: 'Éventails', description: 'Éventails de cérémonie personnalisés selon votre thème.', duration: 45, featured: false },
  { name: 'Décoration', category: 'Décoration', description: 'Décoration complète de votre événement : mariage, baptême, cérémonie.', duration: 480, featured: false },
];

async function main() {
  console.log('→ Paramètres et coordonnées officielles');
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value, label: s.label, group: s.group, type: s.type },
      create: s,
    });
  }

  console.log('→ Compte administrateur');
  const adminPhone = '+226 76 51 88 11';
  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      fullName: 'Administrateur S.DESIGN',
      phone: adminPhone,
      email: 'admin@sdesignshop.bf',
      whatsapp: adminPhone,
      passwordHash: await bcrypt.hash('Admin@2026', 10),
      role: 'ADMIN',
    },
  });

  console.log('→ Formatrice de référence');
  const trainer = await prisma.trainer.upsert({
    where: { id: 'trainer-principal' },
    update: {},
    create: {
      id: 'trainer-principal',
      fullName: 'Formatrice principale',
      speciality: 'Coiffes & Turbans',
      availability: 'Lundi - Samedi, 08h00 - 18h00',
      bio: "Professionnelle de la beauté, elle encadre les formations de S.DESIGN SHOP. Cette fiche est modifiable depuis Admin > Formateurs.",
      isActive: true,
    },
  });

  console.log('→ Formations officielles (8) et prix officiels');
  const officialSlugs: string[] = [];
  let order = 0;
  for (const c of OFFICIAL_COURSES) {
    const slug = slugify(c.name);
    officialSlugs.push(slug);

    const data = {
      name: c.name,
      category: c.category,
      shortDescription: c.shortDescription,
      description: c.description,
      objectives: JSON.stringify(c.objectives),
      requirements: JSON.stringify(c.requirements),
      durationLabel: c.durationLabel,
      durationHours: c.durationHours,
      level: c.level,
      price: c.price, // PRIX OFFICIEL
      depositAmount: 0, // aucun acompte impose : la boutique decide au cas par cas
      capacity: c.capacity,
      isFeatured: c.featured,
      sortOrder: order,
    };

    const course = await prisma.course.upsert({
      where: { slug },
      update: data,
      create: { ...data, slug, status: 'OUVERTE', trainerId: trainer.id },
    });
    order += 1;

    // Le programme n'est (re)cree que s'il est absent, pour ne pas ecraser les
    // modules ajoutes par la formatrice depuis le back-office.
    const existingModules = await prisma.courseModule.count({ where: { courseId: course.id } });
    if (existingModules === 0) {
      await prisma.courseModule.createMany({
        data: c.modules.map((title, i) => ({
          courseId: course.id,
          title,
          orderIndex: i,
          durationHours: Math.max(1, Math.round(c.durationHours / c.modules.length)),
        })),
      });
    }
    console.log(`   ${c.name.padEnd(24)} ${String(c.price).padStart(6)} FCFA`);
  }

  // Toute formation hors liste officielle est retiree du catalogue : supprimee
  // si personne n'y est inscrit, archivee sinon (les dossiers eleves, paiements
  // et certificats lies restent intacts).
  const obsolete = await prisma.course.findMany({
    where: { slug: { notIn: officialSlugs } },
    include: { _count: { select: { enrollments: true } } },
  });
  for (const c of obsolete) {
    if (c._count.enrollments === 0) {
      await prisma.course.delete({ where: { id: c.id } });
      console.log(`   ✖ retirée du catalogue : ${c.name}`);
    } else {
      await prisma.course.update({ where: { id: c.id }, data: { status: 'ARCHIVEE', isFeatured: false } });
      console.log(`   ⌫ archivée (inscriptions existantes) : ${c.name}`);
    }
  }

  console.log('→ Catalogue de prestations');
  let sOrder = 0;
  for (const s of SERVICES) {
    const slug = slugify(s.name);
    await prisma.service.upsert({
      where: { slug },
      // Le tarif n'est pas ecrase : seul l'administrateur le fixe.
      update: { name: s.name, category: s.category, description: s.description, durationMinutes: s.duration, isFeatured: s.featured, sortOrder: sOrder },
      create: {
        slug,
        name: s.name,
        category: s.category,
        description: s.description,
        price: 0,
        durationMinutes: s.duration,
        isAvailable: true,
        isFeatured: s.featured,
        sortOrder: sOrder,
      },
    });
    sOrder += 1;
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED',
      entity: 'SYSTEM',
      details: `Catalogue officiel installé : ${OFFICIAL_COURSES.length} formations, ${SERVICES.length} prestations.`,
    },
  });

  console.log('');
  console.log('✔ Base initialisée avec les données officielles.');
  console.log('  Connexion administrateur');
  console.log(`  Téléphone : ${adminPhone}`);
  console.log('  Mot de passe : Admin@2026');
  console.log('  → À modifier immédiatement depuis Mon profil.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
