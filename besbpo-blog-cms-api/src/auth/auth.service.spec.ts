import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

describe('AuthService.login', () => {
  let service: AuthService;

  const usersServiceMock = {
    findByEmailForAuth: jest.fn(),
  };

  const jwtServiceMock = {
    sign: jest.fn(() => 'signed-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('returns an access token and public user info for a correct password', async () => {
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: 'real-hash',
      displayName: 'Test User',
      roles: ['division_editor'],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const result = await service.login('a@example.com', 'correct-password');

    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('signed-jwt-token');
    expect(result?.user).toEqual({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'Test User',
      roles: ['division_editor'],
    });
    // The password hash must never appear in what gets returned to a
    // caller, even implicitly via a spread of the full user record.
    expect(JSON.stringify(result)).not.toContain('real-hash');
  });

  it('signs the JWT with the user id as subject and their real roles', async () => {
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: 'real-hash',
      displayName: 'Test User',
      roles: ['super_admin'],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    await service.login('a@example.com', 'correct-password');

    expect(jwtServiceMock.sign).toHaveBeenCalledWith({
      sub: 'u1',
      roles: ['super_admin'],
      email: 'a@example.com',
      displayName: 'Test User',
    });
  });

  it('returns null for a wrong password on a real user', async () => {
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: 'real-hash',
      displayName: 'Test User',
      roles: [],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const result = await service.login('a@example.com', 'wrong-password');
    expect(result).toBeNull();
  });

  it('returns null for a non-existent user', async () => {
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce(null);
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const result = await service.login('nobody@example.com', 'any-password');
    expect(result).toBeNull();
  });

  it('still calls bcrypt.compare even when no user was found, for timing-attack safety', async () => {
    // The whole point of this behavior: skipping bcrypt.compare entirely
    // for a non-existent user would make that response measurably
    // faster than a real user's wrong-password attempt (bcrypt.compare
    // is deliberately slow), leaking which emails have accounts via
    // response timing even though the return value is identical either
    // way. This test proves compare() is actually invoked in the
    // no-such-user case, not just that the end result is null.
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce(null);
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await service.login('nobody@example.com', 'any-password');

    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).toHaveBeenCalledWith('any-password', expect.stringMatching(/^\$2b\$/));
  });

  it('does not sign a JWT when the user does not exist', async () => {
    usersServiceMock.findByEmailForAuth.mockResolvedValueOnce(null);
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await service.login('nobody@example.com', 'any-password');

    expect(jwtServiceMock.sign).not.toHaveBeenCalled();
  });
});
