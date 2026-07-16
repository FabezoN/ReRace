import { PrismaClient, Role, TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(' Début du seed...');

  // Nettoyer la base de données (optionnel - à commenter en production)
  console.log(' Nettoyage de la base de données...');
  await prisma.transaction.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.grandPrix.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  // 1. Créer des utilisateurs
  console.log(' Création des utilisateurs...');
  const user1 = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: Role.USER,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: Role.USER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@rerace.com',
      firstName: 'Admin',
      lastName: 'ReRace',
      role: Role.ADMIN,
    },
  });

  console.log(` ${3} utilisateurs créés`);

  // 2. Créer des Grands Prix
  console.log(' Création des Grands Prix...');
  const monacoGP = await prisma.grandPrix.create({
    data: {
      externalId: 'monaco-2024',
      name: 'Monaco Grand Prix',
      circuitName: 'Circuit de Monaco',
      country: 'Monaco',
      date: new Date('2024-05-26T14:00:00Z'),
      season: 2024,
      imageUrl: 'https://example.com/monaco-circuit.jpg',
    },
  });

  const silverstoneGP = await prisma.grandPrix.create({
    data: {
      externalId: 'silverstone-2024',
      name: 'British Grand Prix',
      circuitName: 'Silverstone Circuit',
      country: 'United Kingdom',
      date: new Date('2024-07-07T14:00:00Z'),
      season: 2024,
      imageUrl: 'https://example.com/silverstone-circuit.jpg',
    },
  });

  const spaGP = await prisma.grandPrix.create({
    data: {
      externalId: 'spa-2024',
      name: 'Belgian Grand Prix',
      circuitName: 'Circuit de Spa-Francorchamps',
      country: 'Belgium',
      date: new Date('2024-07-28T14:00:00Z'),
      season: 2024,
      imageUrl: 'https://example.com/spa-circuit.jpg',
    },
  });

  console.log(` ${3} Grands Prix créés`);

  // 3. Créer des billets
  console.log(' Création des billets...');
  
  // Billets pour Monaco
  await prisma.ticket.create({
    data: {
      section: 'Tribune K',
      row: 'Rang 5',
      seat: 'Place 12',
      price: 450.00,
      originalPrice: 500.00,
      currency: 'EUR',
      status: TicketStatus.ON_SALE,
      sellerId: user1.id,
      grandPrixId: monacoGP.id,
    },
  });

  await prisma.ticket.create({
    data: {
      section: 'Tribune A',
      row: 'Rang 1',
      seat: 'Place 3',
      price: 1200.00,
      originalPrice: 1500.00,
      currency: 'EUR',
      status: TicketStatus.ON_SALE,
      sellerId: user2.id,
      grandPrixId: monacoGP.id,
    },
  });

  await prisma.ticket.create({
    data: {
      section: 'Tribune L',
      row: 'Rang 8',
      seat: 'Place 25',
      price: 350.00,
      currency: 'EUR',
      status: TicketStatus.DRAFT,
      sellerId: user1.id,
      grandPrixId: monacoGP.id,
    },
  });

  // Billets pour Silverstone
  await prisma.ticket.create({
    data: {
      section: 'Stowe',
      row: 'Rang 3',
      seat: 'Place 15',
      price: 280.00,
      originalPrice: 320.00,
      currency: 'EUR',
      status: TicketStatus.ON_SALE,
      sellerId: user2.id,
      grandPrixId: silverstoneGP.id,
    },
  });

  await prisma.ticket.create({
    data: {
      section: 'Copse',
      row: 'Rang 1',
      seat: 'Place 7',
      price: 550.00,
      currency: 'EUR',
      status: TicketStatus.ON_SALE,
      sellerId: user1.id,
      grandPrixId: silverstoneGP.id,
    },
  });

  // Billets pour Spa
  await prisma.ticket.create({
    data: {
      section: 'Gold 3',
      row: 'Rang 4',
      seat: 'Place 18',
      price: 320.00,
      originalPrice: 380.00,
      currency: 'EUR',
      status: TicketStatus.ON_SALE,
      sellerId: user2.id,
      grandPrixId: spaGP.id,
    },
  });

  console.log(` ${6} billets créés`);

  // 4. Créer quelques logs d'audit
  console.log(' Création des logs d\'audit...');
  await prisma.auditLog.create({
    data: {
      action: 'TICKET_CREATED',
      details: { ticketId: 'example-id', price: 450 },
      userId: user1.id,
      ipAddress: '192.168.1.1',
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'USER_REGISTERED',
      details: { email: user1.email },
      userId: user1.id,
    },
  });

  console.log(` ${2} logs d'audit créés`);

  console.log(' Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(' Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
