import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { AuthService } from '../auth/auth.service';

const originalFetch = global.fetch;

describe('AuditService', () => {
  let service: AuditService;

  const authServiceMock = { issueServiceToken: jest.fn(() => 'signed-service-token') };
  const configServiceMock = { get: jest.fn(() => 'http://enterprise-svc:8082') };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get(AuditService);
    jest.clearAllMocks();
    global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends the event to POST /api/v1/audit with a signed service token', async () => {
    await service.record({ actorId: 'user-1', action: 'approve_ai_proposed_field', targetId: 'a1' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://enterprise-svc:8082/api/v1/audit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer signed-service-token' }),
      }),
    );
    expect(authServiceMock.issueServiceToken).toHaveBeenCalledWith('besbpo-blog-cms-api');
  });

  it('skips the call entirely when actorId is empty, without ever calling fetch', async () => {
    await service.record({ actorId: '', action: 'approve_ai_proposed_field' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips the call when ENTERPRISE_SERVICE_URL is not configured', async () => {
    (configServiceMock.get as jest.Mock).mockReturnValueOnce(undefined);
    await service.record({ actorId: 'user-1', action: 'approve_ai_proposed_field' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never throws when the audit call fails after retries — fail-soft by design', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 } as Response));
    await expect(
      service.record({ actorId: 'user-1', action: 'approve_ai_proposed_field' }),
    ).resolves.toBeUndefined();
  });

  it('never throws when fetch itself rejects (network failure)', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network unreachable')));
    await expect(
      service.record({ actorId: 'user-1', action: 'approve_ai_proposed_field' }),
    ).resolves.toBeUndefined();
  });
});
