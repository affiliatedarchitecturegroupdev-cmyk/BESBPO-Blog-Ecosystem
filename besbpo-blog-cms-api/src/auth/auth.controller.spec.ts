import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/role.enum';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  const usersServiceMock = {
    count: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns the login result on success', async () => {
      authServiceMock.login.mockResolvedValueOnce({
        accessToken: 'token',
        user: { id: 'u1', email: 'a@example.com', displayName: 'A', roles: [] },
      });

      const result = await controller.login('a@example.com', 'password');
      expect(result.accessToken).toBe('token');
    });

    it('throws UnauthorizedException when AuthService.login returns null', async () => {
      authServiceMock.login.mockResolvedValueOnce(null);
      await expect(controller.login('a@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a missing email without calling AuthService', async () => {
      await expect(controller.login('', 'password')).rejects.toThrow(UnauthorizedException);
      expect(authServiceMock.login).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException for a missing password without calling AuthService', async () => {
      await expect(controller.login('a@example.com', '')).rejects.toThrow(UnauthorizedException);
      expect(authServiceMock.login).not.toHaveBeenCalled();
    });
  });

  describe('register — bootstrap case (zero users exist)', () => {
    it('allows registration with no authenticated caller at all', async () => {
      usersServiceMock.count.mockResolvedValueOnce(0);
      usersServiceMock.create.mockResolvedValueOnce({
        id: 'u1',
        email: 'first@example.com',
        displayName: 'First Admin',
        roles: [Role.SUPER_ADMIN],
      });

      const result = await controller.register('first@example.com', 'password', 'First Admin', undefined, {});
      expect(result.roles).toEqual([Role.SUPER_ADMIN]);
    });

    it('always grants SUPER_ADMIN on the bootstrap registration, regardless of requested roles', async () => {
      usersServiceMock.count.mockResolvedValueOnce(0);
      usersServiceMock.create.mockResolvedValueOnce({
        id: 'u1',
        email: 'first@example.com',
        displayName: 'First Admin',
        roles: [Role.SUPER_ADMIN],
      });

      await controller.register('first@example.com', 'password', 'First Admin', ['division_author'], {});

      // The requested role ('division_author') must be ignored entirely
      // for the bootstrap registration — always SUPER_ADMIN, or the
      // platform could end up with a first account that can't grant
      // itself the access needed to register anyone else.
      expect(usersServiceMock.create).toHaveBeenCalledWith(
        'first@example.com',
        'password',
        'First Admin',
        [Role.SUPER_ADMIN],
      );
    });
  });

  describe('register — gated case (at least one user already exists)', () => {
    it('rejects registration with no authenticated caller', async () => {
      usersServiceMock.count.mockResolvedValueOnce(1);
      await expect(
        controller.register('new@example.com', 'password', 'New User', undefined, {}),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('rejects registration from an authenticated caller who is not a super admin', async () => {
      usersServiceMock.count.mockResolvedValueOnce(1);
      await expect(
        controller.register('new@example.com', 'password', 'New User', undefined, {
          user: { id: 'caller', roles: [Role.DIVISION_EDITOR] },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('allows registration from an authenticated super admin', async () => {
      usersServiceMock.count.mockResolvedValueOnce(1);
      usersServiceMock.create.mockResolvedValueOnce({
        id: 'u2',
        email: 'new@example.com',
        displayName: 'New User',
        roles: ['division_author'],
      });

      const result = await controller.register('new@example.com', 'password', 'New User', ['division_author'], {
        user: { id: 'caller', roles: [Role.SUPER_ADMIN] },
      });

      expect(result.email).toBe('new@example.com');
      expect(usersServiceMock.create).toHaveBeenCalledWith(
        'new@example.com',
        'password',
        'New User',
        ['division_author'],
      );
    });
  });
});
