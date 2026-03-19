/**
 * TESTS UNITAIRES — GrandPrixService (stub corrigé)
 *
 * Cause de l'échec d'origine :
 *   Le CLI NestJS génère un stub qui instancie GrandPrixService sans fournir
 *   PrismaService dans le module de test → erreur d'injection de dépendances.
 *
 * Correctif : injecter un mock de PrismaService via { provide, useValue }.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GrandPrixService } from './grand-prix.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  grandPrix: {
    findMany:  jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    upsert:    jest.fn(),
  },
};

describe('GrandPrixService', () => {
  let service: GrandPrixService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrandPrixService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GrandPrixService>(GrandPrixService);
    jest.clearAllMocks();
  });

  it('✅ le service doit être instancié correctement', () => {
    expect(service).toBeDefined();
  });

  it('✅ findAll() doit retourner la liste des GPs (via Prisma mocké)', async () => {
    // Arrange
    mockPrisma.grandPrix.findMany.mockResolvedValue([]);

    // Act
    const result = await service.findAll();

    // Assert
    expect(result).toEqual([]);
    expect(mockPrisma.grandPrix.findMany).toHaveBeenCalledTimes(1);
  });

  it('✅ findOne() doit retourner null si aucun GP ne correspond', async () => {
    // Arrange
    mockPrisma.grandPrix.findUnique.mockResolvedValue(null);

    // Act
    const result = await service.findOne('uuid-inexistant');

    // Assert
    expect(result).toBeNull();
  });
});
