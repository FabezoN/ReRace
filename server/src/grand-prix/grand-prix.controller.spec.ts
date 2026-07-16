
import { Test, TestingModule } from '@nestjs/testing';
import { GrandPrixController } from './grand-prix.controller';
import { GrandPrixService } from './grand-prix.service';

const GP_ID = 'b566a345-0001-4001-8001-222222222222';

const mockGrandPrixService = {
  findAll:       jest.fn().mockResolvedValue([]),
  findOne:       jest.fn().mockResolvedValue(null),
  syncFromJolpica: jest.fn().mockResolvedValue({ success: true, count: 0, grandPrix: [] }),
};

describe('GrandPrixController', () => {
  let controller: GrandPrixController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrandPrixController],
      providers: [
        { provide: GrandPrixService, useValue: mockGrandPrixService },
      ],
    }).compile();

    controller = module.get<GrandPrixController>(GrandPrixController);
    jest.clearAllMocks();
  });

  it('le contrôleur doit être instancié correctement', () => {
    expect(controller).toBeDefined();
  });

  it('findAll() doit déléguer au GrandPrixService', async () => {
    mockGrandPrixService.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(mockGrandPrixService.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('findOne() doit déléguer au GrandPrixService avec le bon id', async () => {
    mockGrandPrixService.findOne.mockResolvedValue(null);

    await controller.findOne(GP_ID);

    expect(mockGrandPrixService.findOne).toHaveBeenCalledWith(GP_ID);
  });
});
