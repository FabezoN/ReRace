/**
 * TESTS UNITAIRES — ApiKeyGuard
 *
 * Garantit que les routes de synchronisation calendrier sont protégées :
 *   - Clé API valide (header x-api-key) → accès autorisé
 *   - Clé API manquante → UnauthorizedException
 *   - Clé API incorrecte → UnauthorizedException
 *   - Variable API_KEY non configurée → UnauthorizedException (fail-safe)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ExecutionContext } from '@nestjs/common';

const VALID_API_KEY = 'test-api-key-super-secure-123';

// ─── Helper : crée un ExecutionContext simulé ─────────────────────────────────

const createMockContext = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

// ─── Suite de tests ───────────────────────────────────────────────────────────

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let originalApiKey: string | undefined;

  beforeEach(async () => {
    originalApiKey = process.env.API_KEY;
    process.env.API_KEY = VALID_API_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyGuard],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
  });

  afterEach(() => {
    process.env.API_KEY = originalApiKey;
  });

  it('✅ le guard doit être instancié correctement', () => {
    expect(guard).toBeDefined();
  });

  it('✅ doit autoriser si la clé API dans le header x-api-key est correcte', () => {
    const context = createMockContext({ 'x-api-key': VALID_API_KEY });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('❌ doit lever UnauthorizedException si le header x-api-key est absent', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
  });

  it('❌ doit lever UnauthorizedException si la clé API est incorrecte', () => {
    const context = createMockContext({ 'x-api-key': 'mauvaise-cle' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
  });

  it('❌ doit lever UnauthorizedException si API_KEY n\'est pas configurée (fail-safe)', () => {
    delete process.env.API_KEY;
    const context = createMockContext({ 'x-api-key': VALID_API_KEY });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('API_KEY non configurée côté serveur');
  });
});
