import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let prisma: {
    user: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    trainingPreferences: { findUnique: ReturnType<typeof vi.fn> };
  };
  let authService: AuthService;

  beforeEach(() => {
    prisma = {
      user: { create: vi.fn(), findUnique: vi.fn() },
      trainingPreferences: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    authService = new AuthService(prisma as never, new JwtService({ secret: 'test-secret' }));
  });

  describe('register', () => {
    it('slaat het wachtwoord nooit in leesbare vorm op', async () => {
      prisma.user.create.mockImplementation(({ data }: { data: { passwordHash: string } }) =>
        Promise.resolve({ id: '1', email: 'test@example.com', createdAt: new Date(), ...data }),
      );

      await authService.register({ email: 'test@example.com', password: 'wachtwoord123' });

      const { passwordHash } = prisma.user.create.mock.calls[0][0].data;
      expect(passwordHash).not.toBe('wachtwoord123');
      expect(passwordHash.length).toBeGreaterThan(20);
    });

    it('gooit een ConflictException als het e-mailadres al bestaat', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        authService.register({ email: 'test@example.com', password: 'wachtwoord123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('geeft een token terug bij een geldige combinatie', async () => {
      const passwordHash = await bcrypt.hash('wachtwoord123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        passwordHash,
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'wachtwoord123',
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).toEqual({ id: '1', email: 'test@example.com' });
      expect(result.hasCompletedOnboarding).toBe(false);
    });

    it('gooit een UnauthorizedException bij een fout wachtwoord', async () => {
      const passwordHash = await bcrypt.hash('wachtwoord123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        passwordHash,
      });

      await expect(
        authService.login({ email: 'test@example.com', password: 'foutwachtwoord' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('gooit een UnauthorizedException als het e-mailadres onbekend is', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'onbekend@example.com', password: 'wachtwoord123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
