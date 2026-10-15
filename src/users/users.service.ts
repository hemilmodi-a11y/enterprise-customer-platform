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
import { UserResponseDto } from './dto/user-response.dto';

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

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isAvailable: true,
        supportCategories: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { id: 'ASC' },
    });
    return users.map((user) => this.toResponse(user));
  }

  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isAvailable: true,
        supportCategories: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.toResponse(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: this.normalizeEmail(email) },
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
    const email = this.normalizeEmail(data.email);
    const existingUser = await this.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.userRepository.create({
      ...data,
      email,
    });

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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isAvailable: user.isAvailable,
      supportCategories: user.supportCategories,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
