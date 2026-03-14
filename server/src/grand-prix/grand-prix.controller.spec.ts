import { Test, TestingModule } from '@nestjs/testing';
import { GrandPrixController } from './grand-prix.controller';
import { GrandPrixService } from './grand-prix.service';

describe('GrandPrixController', () => {
  let controller: GrandPrixController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrandPrixController],
      providers: [GrandPrixService],
    }).compile();

    controller = module.get<GrandPrixController>(GrandPrixController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
