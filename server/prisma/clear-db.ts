import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log(' Début du nettoyage de la base de données...');

  try {
    // Supprimer dans l'ordre pour respecter les contraintes de clés étrangères
    console.log('Suppression des transactions...');
    await prisma.transaction.deleteMany();

    console.log('Suppression des billets...');
    await prisma.ticket.deleteMany();

    console.log('Suppression des logs d\'audit...');
    await prisma.auditLog.deleteMany();

    console.log('Suppression des Grands Prix...');
    await prisma.grandPrix.deleteMany();

    console.log('Suppression des utilisateurs...');
    await prisma.user.deleteMany();

    console.log(' Base de données vidée avec succès !');
  } catch (error) {
    console.error(' Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
