/**
 * TESTS UNITAIRES — AppController (stub corrigé)
 *
 * Cause de l'échec d'origine :
 *   AppController dépend de AppService ET PrismaService (pour les routes /profile).
 *   Le stub ne fournissait que AppService → NestJS ne pouvait pas résoudre PrismaService.
 *
 * Correctif : mocker les deux dépendances.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
  },
  ticket: {
    findMany: jest.fn(),
  },
  transaction: {
    findMany:    jest.fn(),
    updateMany:  jest.fn(),
    deleteMany:  jest.fn(),
  },
  auditLog: {
    deleteMany: jest.fn(),
  },
};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
    jest.clearAllMocks();
  });

  it('✅ le contrôleur doit être instancié correctement', () => {
    expect(appController).toBeDefined();
  });

  describe('GET / — health check', () => {
    it('✅ doit retourner "Hello World!"', () => {
      // Act & Assert
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
