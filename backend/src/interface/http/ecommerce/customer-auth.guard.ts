import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly auth: CustomerAuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Token ausente');
    const payload = this.auth.verifyToken(token);
    req.customer = payload;   // { sub, tenantId, email, type }
    return true;
  }
}

/** Decorator pra extrair o customer logado dos handlers. */
export const CurrentCustomer = createParamDecorator(
  (data: keyof any | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const customer = req.customer;
    return data ? customer?.[data] : customer;
  },
);
