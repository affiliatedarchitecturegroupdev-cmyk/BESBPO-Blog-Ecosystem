import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthorsService } from './authors.service';
import { Author } from './entities/author.entity';

describe('AuthorsService', () => {
  let service: AuthorsService;
  let existingAuthor: Partial<Author> | null;

  const repoMock = {
    findOne: jest.fn(() => Promise.resolve(existingAuthor)),
    create: jest.fn((partial: Partial<Author>) => partial as Author),
    save: jest.fn((a: Author) => Promise.resolve({ ...a, id: a.id ?? 'new-author-id' })),
  };

  beforeEach(async () => {
    existingAuthor = null;

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorsService, { provide: getRepositoryToken(Author), useValue: repoMock }],
    }).compile();

    service = module.get(AuthorsService);
    jest.clearAllMocks();
  });

  describe('getOrCreateForUser', () => {
    it('returns the existing author record when one already exists for this user', async () => {
      existingAuthor = { id: 'author-1', userId: 'user-1', displayName: 'Existing Name' };

      const result = await service.getOrCreateForUser('user-1', 'A Different Name');

      expect(result.id).toBe('author-1');
      // The existing record's own display name is preserved, NOT
      // overwritten with whatever was passed this time — getOrCreate
      // means find-or-make, not find-and-update.
      expect(result.displayName).toBe('Existing Name');
      expect(repoMock.create).not.toHaveBeenCalled();
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('looks up the existing author by userId specifically, not some other field', async () => {
      await service.getOrCreateForUser('user-1', 'A User');
      expect(repoMock.findOne).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('creates a new author record when none exists for this user yet', async () => {
      existingAuthor = null;

      const result = await service.getOrCreateForUser('user-2', 'New User');

      expect(repoMock.create).toHaveBeenCalledWith({ userId: 'user-2', displayName: 'New User' });
      expect(repoMock.save).toHaveBeenCalled();
      expect(result.id).toBeDefined();
    });

    it('the newly created author record carries the given userId and displayName', async () => {
      existingAuthor = null;
      const result = await service.getOrCreateForUser('user-3', 'Third User');
      expect(result.userId).toBe('user-3');
      expect(result.displayName).toBe('Third User');
    });
  });
});
