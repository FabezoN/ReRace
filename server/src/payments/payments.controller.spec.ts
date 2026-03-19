/**
 * TESTS UNITAIRES — PaymentsController (stub corrigé)
 *
 * Cause de l'échec d'origine :
 *   Le stub instanciait PaymentsController sans fournir PaymentsService
 *   → NestJS ne pouvait pas résoudre la dépendance.
 *
 * Correctif : injecter un mock de PaymentsService.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

const TICKET_ID   = 'c7d8e9f0-0002-4002-8002-333333333333';
const SESSION_ID  = 'cs_test_monaco_2026';
const BUYER_EMAIL = 'max.verstappen@rerace.io';

const mockPaymentsService = {
  createCheckoutSession: jest.fn().mockResolvedValue({
    sessionId: SESSION_ID,
    url:       'https://checkout.stripe.com/pay/cs_test_monaco_2026',
  }),
  handleWebhook:         jest.fn().mockResolvedValue({ received: true }),
  verifySession:         jest.fn().mockResolvedValue({ success: true }),
  cancelPendingPurchase: jest.fn().mockResolvedValue({ cancelled: true }),
};

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: mockPaymentsService },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    jest.clearAllMocks();
  });

  it('✅ le contrôleur doit être instancié correctement', () => {
    expect(controller).toBeDefined();
  });

  it('✅ createCheckoutSession() doit déléguer au PaymentsService', async () => {
    // Arrange
    const dto = { ticketId: TICKET_ID, email: BUYER_EMAIL };

    // Act
    const result = await controller.createCheckoutSession(dto);

    // Assert
    expect(mockPaymentsService.createCheckoutSession).toHaveBeenCalledWith(TICKET_ID, BUYER_EMAIL);
    expect(result).toMatchObject({ sessionId: SESSION_ID });
  });

  it('✅ verifySession() doit déléguer au PaymentsService avec le bon sessionId', async () => {
    // Arrange
    mockPaymentsService.verifySession.mockResolvedValue({ success: true });

    // Act
    const result = await controller.verifySession(SESSION_ID);

    // Assert
    expect(mockPaymentsService.verifySession).toHaveBeenCalledWith(SESSION_ID);
    expect(result).toEqual({ success: true });
  });

  it('✅ cancelPurchase() doit déléguer au PaymentsService', async () => {
    // Act
    const result = await controller.cancelPurchase(TICKET_ID);

    // Assert
    expect(mockPaymentsService.cancelPendingPurchase).toHaveBeenCalledWith(TICKET_ID);
    expect(result).toEqual({ cancelled: true });
  });
});
