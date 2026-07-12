import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TagsService } from './tags.service';
import { Tag } from './entities/tag.entity';

describe('TagsService.findOrCreateMany', () => {
  let service: TagsService;
  let existingTags: Tag[];

  const repoMock = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve(existingTags)),
    })),
    create: jest.fn((partial: Partial<Tag>) => partial as Tag),
    save: jest.fn((tag: Tag) => Promise.resolve({ ...tag, id: `generated-${tag.name}` })),
  };

  beforeEach(async () => {
    existingTags = [{ id: '1', name: 'case-study' }];

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsService, { provide: getRepositoryToken(Tag), useValue: repoMock }],
    }).compile();

    service = module.get(TagsService);
    jest.clearAllMocks();
  });

  it('returns an empty array for an empty input', async () => {
    const result = await service.findOrCreateMany([]);
    expect(result).toEqual([]);
  });

  it('deduplicates and normalises casing/whitespace before resolving', async () => {
    existingTags = [{ id: '1', name: 'case-study' }];
    const result = await service.findOrCreateMany(['Case-Study', ' case-study ', 'case-study']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('case-study');
  });

  it('creates tags that do not yet exist, leaving existing ones untouched', async () => {
    existingTags = [{ id: '1', name: 'case-study' }];
    const result = await service.findOrCreateMany(['case-study', 'investor-update']);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name).sort()).toEqual(['case-study', 'investor-update']);
    expect(repoMock.save).toHaveBeenCalledTimes(1); // only the new tag was created
  });
});
