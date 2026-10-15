import { describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the safe response projection provided by the service', async () => {
    const safeUser = {
      id: 12,
      email: 'agent@example.test',
      firstName: 'Support',
      lastName: 'Agent',
      isActive: true,
      isAvailable: true,
      supportCategories: 'Support',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService.findAll.mockResolvedValue([safeUser]);
    usersService.findById.mockResolvedValue(safeUser);

    await expect(controller.findAll()).resolves.toEqual([safeUser]);
    await expect(controller.findById(12)).resolves.toEqual(safeUser);
    expect(JSON.stringify(safeUser)).not.toContain('passwordHash');
  });
});
