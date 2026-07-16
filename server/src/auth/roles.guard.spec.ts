/**
 * TESTS UNITAIRES — RolesGuard (RBAC)
 *
 * Garantit que le contrôle d'accès basé sur les rôles (RBAC) fonctionne :
 *   - Route sans restriction → accès autorisé pour tous
 *   - Rôle ADMIN requis + user ADMIN → accès autorisé
 *   - Rôle ADMIN requis + user USER → ForbiddenException "Droits insuffisants"
 *   - Rôle ADMIN requis + user sans rôle → ForbiddenException "Accès refusé"
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ExecutionContext } from '@nestjs/common';

// ─── Mock Reflector ───────────────────────────────────────────────────────────

const mockReflector = {
  getAllAndOverride: jest.fn(),
};

// ─── Helper : crée un ExecutionContext simulé ─────────────────────────────────

const createMockContext = (user: any): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass:   jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    jest.clearAllMocks();
  });

  it('✅ le guard doit être instancié correctement', () => {
    expect(guard).toBeDefined();
  });

  it('✅ doit autoriser si aucun rôle n\'est requis sur la route (publique)', () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext(null);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('✅ doit autoriser si la liste de rôles requis est vide', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ role: 'USER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('✅ doit autoriser un utilisateur ADMIN sur une route @Roles("ADMIN")', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 'admin-001', role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('❌ doit lever ForbiddenException si l\'utilisateur a le rôle USER et qu\'ADMIN est requis', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 'user-001', role: 'USER' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Droits insuffisants');
  });

  it('❌ doit lever ForbiddenException si l\'utilisateur n\'a pas de champ role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext({ id: 'user-001' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Accès refusé');
  });

  it('❌ doit lever ForbiddenException si l\'objet user est null', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    const context = createMockContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
