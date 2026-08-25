import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get()
  root() {
    return {
      name: 'Aamako Agro API',
      status: 'ok',
      docs: '/api/docs',
      endpoints: ['/api/auth', '/api/products', '/api/categories', '/api/pricing', '/api/cart', '/api/orders', '/api/wholesale', '/api/admin/users'],
    };
  }
}
