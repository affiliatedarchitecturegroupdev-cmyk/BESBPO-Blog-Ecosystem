import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  /** Excludes passwordHash (the entity's `select: false` default) — safe
   * to return directly in an API response. */
  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  /** Same exclusion as findById — for anything that just needs to know a
   * user exists or read their profile, not verify a password. */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  /**
   * The ONLY method that ever includes passwordHash in its result —
   * used exclusively by AuthService.login to verify a password.
   * Deliberately named differently from findByEmail (not an optional
   * parameter on that method) so a future caller reaching for "the
   * obvious" user-lookup method by habit gets the safe one by default,
   * not the one carrying a password hash.
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email },
      select: ['id', 'email', 'passwordHash', 'displayName', 'roles', 'createdAt', 'updatedAt'],
    });
  }

  /** Used by AuthController.register to decide whether this is the
   * bootstrap case (zero users exist yet — see that controller for the
   * full reasoning) or a normal registration requiring an already-
   * authenticated SUPER_ADMIN. */
  async count(): Promise<number> {
    return this.usersRepo.count();
  }

  async create(email: string, password: string, displayName: string, roles: string[]): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException(`A user with email '${email}' already exists.`);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({ email, passwordHash, displayName, roles });
    return this.usersRepo.save(user);
  }
}
