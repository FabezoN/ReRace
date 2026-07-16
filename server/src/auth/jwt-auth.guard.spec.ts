/**
 * TESTS UNITAIRES — JwtAuthGuard
 *
 * Garantit que l'authentification JWT est correctement appliquée :
 *   - Absence de header Authorization → UnauthorizedException "Token manquant"
 *   - Header non-Bearer → UnauthorizedException
 *   - Token valide → user attaché à la requête, canActivate retourne true
 *   - Token expiré ou invalide → UnauthorizedException "Token invalide ou expiré"
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

// ─── Mock JwtStrategy ─────────────────────────────────────────────────────────

const mockJwtStrategy = {
  validateTokenDirectly: jest.fn(),
};

const mockModuleRef = {
  get: jest.fn().mockReturnValue(mockJwtStrategy),
};

// ─── Helper : crée un ExecutionContext simulé avec requête mutable ─────────────

const createMockContext = (headers: Record<string, string>): { context: ExecutionContext; request: any } => {
  const request = { headers };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
};

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jest.clearAllMocks();
    mockModuleRef.get.mockReturnValue(mockJwtStrategy);
  });

  it('✅ le guard doit être instancié correctement', () => {
    expect(guard).toBeDefined();
  });

  it('❌ doit lever UnauthorizedException si aucun header Authorization n\'est présent', async () => {
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token manquant');
  });

  it('❌ doit lever UnauthorizedException si le header n\'est pas du format Bearer', async () => {
    const { context } = createMockContext({ authorization: 'Basic dXNlcjpwYXNz' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token manquant');
  });

  it('✅ doit authentifier et attacher l\'utilisateur à la requête si le token est valide', async () => {
    const mockUser = { id: 'user-uuid-001', email: 'max@rerace.io', role: 'USER' };
    mockJwtStrategy.validateTokenDirectly.mockResolvedValue(mockUser);

    const { context, request } = createMockContext({ authorization: 'Bearer valid.jwt.token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockUser);
    expect(mockJwtStrategy.validateTokenDirectly).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('❌ doit lever UnauthorizedException si la validation du token lève une erreur', async () => {
    mockJwtStrategy.validateTokenDirectly.mockRejectedValue(new Error('jwt expired'));
    const { context } = createMockContext({ authorization: 'Bearer expired.jwt.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token invalide ou expiré');
  });

  it('❌ doit lever UnauthorizedException si le token est malformé', async () => {
    mockJwtStrategy.validateTokenDirectly.mockRejectedValue(new Error('invalid token'));
    const { context } = createMockContext({ authorization: 'Bearer not-a-real-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
