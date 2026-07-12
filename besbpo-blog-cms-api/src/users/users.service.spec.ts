import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('hashed-password')),
}));
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let mockUser: Partial<User> | null;

  const repoMock = {
    findOne: jest.fn((opts: any) => Promise.resolve(mockUser)),
    create: jest.fn((partial: Partial<User>) => partial as User),
    save: jest.fn((u: User) => Promise.resolve({ ...u, id: 'u1' })),
    count: jest.fn(() => Promise.resolve(0)),
  };

  beforeEach(async () => {
    mockUser = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repoMock }],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('findById / findByEmail', () => {
    it('findById does not request the password hash column', async () => {
      await service.findById('u1');
      const callArgs = repoMock.findOne.mock.calls[0][0];
      expect(callArgs.select).toBeUndefined();
    });

    it('findByEmail does not request the password hash column either', async () => {
      await service.findByEmail('a@example.com');
      const callArgs = repoMock.findOne.mock.calls[0][0];
      expect(callArgs.select).toBeUndefined();
    });
  });

  describe('findByEmailForAuth', () => {
    it('explicitly requests passwordHash, unlike findByEmail', async () => {
      await service.findByEmailForAuth('a@example.com');
      const callArgs = repoMock.findOne.mock.calls[0][0];
      expect(callArgs.select).toContain('passwordHash');
    });
  });

  describe('create', () => {
    it('hashes the password before storing the user, never the plaintext', async () => {
      const user = await service.create('new@example.com', 'plaintext-password', 'New User', ['division_author']);
      expect(bcrypt.hash).toHaveBeenCalledWith('plaintext-password', 12);
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed-password' }),
      );
      // The plaintext must never reach the repository layer under any key.
      const createCallArg = repoMock.create.mock.calls[0][0];
      expect(Object.values(createCallArg)).not.toContain('plaintext-password');
    });

    it('rejects creating a user with an email that already exists', async () => {
      mockUser = { id: 'existing', email: 'taken@example.com' };
      await expect(
        service.create('taken@example.com', 'password', 'Someone', []),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('count', () => {
    it('returns the repository count directly', async () => {
      repoMock.count.mockResolvedValueOnce(3);
      const result = await service.count();
      expect(result).toBe(3);
    });
  });
});
