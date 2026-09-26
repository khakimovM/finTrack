import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { ConflictDomainException } from '../../../common/exceptions/domain.exception';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-123',
    name: 'Aziz Karimov',
    email: 'aziz@mail.uz',
    passwordHash: '',
    baseCurrency: 'UZS',
    locale: 'uz',
    strictMode: false,
    avatarUrl: null,
    emailVerifiedAt: null,
    createdAt: new Date('2026-08-29T10:00:00.000Z'),
    updatedAt: new Date('2026-08-29T10:00:00.000Z'),
    deletedAt: null,
  };

  const mockRepository = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUserWithDefaults: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenByHash: jest.fn(),
    revokeRefreshToken: jest.fn(),
    deleteRefreshTokenByHash: jest.fn(),
    revokeTokenFamily: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    getActiveSessions: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockImplementation((payload) => Promise.resolve(`signed-${JSON.stringify(payload)}`)),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: unknown) => {
      const config: Record<string, unknown> = {
        BCRYPT_ROUNDS: 10,
        JWT_ACCESS_SECRET: 'test_access_secret_min_32_characters_here',
        JWT_REFRESH_SECRET: 'test_refresh_secret_min_32_characters_here',
        ACCESS_TOKEN_TTL: '15m',
        REFRESH_TOKEN_TTL: '7d',
      };
      return config[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockUser.passwordHash = await bcrypt.hash('Parol123!', 10);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register user and return user object without passwordHash', async () => {
      mockRepository.findUserByEmail.mockResolvedValue(null);
      mockRepository.createUserWithDefaults.mockResolvedValue(mockUser);
      mockRepository.createRefreshToken.mockResolvedValue({});

      const result = await service.register(
        { name: 'Aziz Karimov', email: 'aziz@mail.uz', password: 'Parol123!' },
        { userAgent: 'Jest', ipAddress: '127.0.0.1' },
      );

      expect(mockRepository.findUserByEmail).toHaveBeenCalledWith('aziz@mail.uz');
      expect(mockRepository.createUserWithDefaults).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Aziz Karimov',
          email: 'aziz@mail.uz',
        }),
      );
      expect(result.user).toEqual({
        id: 'user-123',
        name: 'Aziz Karimov',
        email: 'aziz@mail.uz',
        baseCurrency: 'UZS',
        locale: 'uz',
        strictMode: false,
        avatarUrl: null,
        createdAt: '2026-08-29T10:00:00.000Z',
      });
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw ConflictDomainException with EMAIL_TAKEN if email exists', async () => {
      mockRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register(
          { name: 'Aziz', email: 'aziz@mail.uz', password: 'Parol123!' },
          {},
        ),
      ).rejects.toThrow(ConflictDomainException);
    });
  });

  describe('login', () => {
    it('should log in successfully with correct credentials', async () => {
      mockRepository.findUserByEmail.mockResolvedValue(mockUser);
      mockRepository.createRefreshToken.mockResolvedValue({});

      const result = await service.login(
        { email: 'aziz@mail.uz', password: 'Parol123!' },
        { userAgent: 'Jest' },
      );

      expect(result.user.email).toBe('aziz@mail.uz');
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw generic INVALID_CREDENTIALS when user is not found', async () => {
      mockRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@mail.uz', password: 'Parol123!' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw generic INVALID_CREDENTIALS when password does not match', async () => {
      mockRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'aziz@mail.uz', password: 'WrongPassword!' }, {}),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should throw TOKEN_REUSE_DETECTED and revoke family if token was already revoked', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', familyId: 'fam-1' });
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-123',
        familyId: 'fam-1',
        revokedAt: new Date(),
      });

      await expect(service.refresh('old-raw-token', {})).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRepository.revokeTokenFamily).toHaveBeenCalledWith('fam-1');
    });

    it('treats a token rotated seconds ago as a concurrent refresh, not theft', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', familyId: 'fam-1' });
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-123',
        familyId: 'fam-1',
        revokedAt: new Date(Date.now() - 2_000),
        replacedByHash: 'next-hash',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refresh('old-raw-token', {})).rejects.toMatchObject({
        response: { code: 'REFRESH_RACE' },
      });
      expect(mockRepository.revokeTokenFamily).not.toHaveBeenCalled();
    });

    it('drops its freshly minted token when another request won the rotation', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', familyId: 'fam-1' });
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-123',
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockRepository.findUserById.mockResolvedValue(mockUser);
      mockRepository.createRefreshToken.mockResolvedValue({});
      mockRepository.revokeRefreshToken.mockResolvedValue(false);

      await expect(service.refresh('raw', {})).rejects.toMatchObject({ response: { code: 'REFRESH_RACE' } });
      expect(mockRepository.deleteRefreshTokenByHash).toHaveBeenCalledWith(expect.any(String));
    });

    it('rejects an expired refresh token', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', familyId: 'fam-1' });
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-123',
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1),
      });

      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(mockRepository.createRefreshToken).not.toHaveBeenCalled();
    });

    it('should rotate token successfully within the same family', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-123', familyId: 'fam-1' });
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-123',
        familyId: 'fam-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockRepository.findUserById.mockResolvedValue(mockUser);
      mockRepository.createRefreshToken.mockResolvedValue({});
      mockRepository.revokeRefreshToken.mockResolvedValue(true);

      const result = await service.refresh('valid-raw-token', {});

      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith('tok-1', expect.any(String));
      expect(result.user.id).toBe('user-123');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      mockRepository.findRefreshTokenByHash.mockResolvedValue({
        id: 'tok-1',
        revokedAt: null,
      });

      await service.logout('raw-token');
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith('tok-1');
    });

    it('should revoke all tokens on logoutAll', async () => {
      await service.logoutAll('user-123');
      expect(mockRepository.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    });
  });
});
