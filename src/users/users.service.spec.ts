import { describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService public response projection', () => {
  it('selects and returns safe user fields for list and detail', async () => {
    const user = {
      id: 4,
      email: 'agent@example.test',
      passwordHash: 'must-not-be-read-or-returned',
      firstName: 'Support',
      lastName: 'Agent',
      isActive: true,
      isAvailable: true,
      supportCategories: 'Support',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    } as User;
    const userRepository = {
      find: jest.fn().mockResolvedValue([user]),
      findOne: jest.fn().mockResolvedValue(user),
    };
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: {},
        },
      ],
    }).compile();
    const service = module.get(UsersService);

    const expectedUser = {
      id: 4,
      email: 'agent@example.test',
      firstName: 'Support',
      lastName: 'Agent',
      isActive: true,
      isAvailable: true,
      supportCategories: 'Support',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const expectedSelection = {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      isAvailable: true,
      supportCategories: true,
      createdAt: true,
      updatedAt: true,
    };

    await expect(service.findAll()).resolves.toEqual([expectedUser]);
    expect(userRepository.find).toHaveBeenCalledWith({
      select: expectedSelection,
      order: { id: 'ASC' },
    });

    await expect(service.findById(4)).resolves.toEqual(expectedUser);
    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 4 },
      select: expectedSelection,
    });

    await module.close();
  });
});
