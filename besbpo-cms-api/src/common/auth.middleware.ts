import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow public endpoints without auth
      const publicPaths = [
        '/healthz',
        '/auth/login',
        '/auth/register',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/articles',  // Public article listing
      ];
      
      if (!publicPaths.some(path => req.path.startsWith(path))) {
        // For development, allow all requests
        if (process.env.NODE_ENV === 'development') {
          return next();
        }
        throw new UnauthorizedException('Authentication required');
      }
    } else {
      const token = authHeader.substring(7);
      // TODO: Validate JWT and attach user to request
      // req.user = await this.jwtService.verify(token);
      console.log('Auth token present:', token.substring(0, 20) + '...');
    }
    
    next();
  }
}
