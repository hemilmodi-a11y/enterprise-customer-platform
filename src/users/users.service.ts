import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

async findByEmail(email: string): Promise<User | null> {
  return this.userRepository.findOne({
    where: { email },
  });
}

async findRolesByUserId(userId: number): Promise<string[]> {
  const userRoles = await this.userRoleRepository.find({
    where: {
      user: {
        id: userId,
      },
    },
    relations: {
      role: true,
    },
  });

  return userRoles.map((userRole) => userRole.role.name);
}

  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(data.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.userRepository.create(data);

    return this.userRepository.save(user);
  }

  async assignCustomerRole(user: User): Promise<void> {
    const customerRole = await this.roleRepository.findOne({
      where: { name: 'Customer' },
    });

    if (!customerRole) {
      throw new NotFoundException('Customer role not found');
    }

    const userRole = this.userRoleRepository.create({
      user,
      role: customerRole,
    });

    await this.userRoleRepository.save(userRole);
  }
}