import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { CartService } from './cart.service';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  /** Anonymous carts identified by X-Cart-Session header (set by frontend). */
  private session(req: Request): string | undefined {
    return (req.headers['x-cart-session'] as string) || undefined;
  }

  @Public()
  @Get()
  view(@Req() req: Request, @CurrentUser() user?: { id: string }) {
    return this.cartService.view(user?.id, this.session(req));
  }

  @Public()
  @Post('items')
  add(
    @Req() req: Request,
    @Body() dto: AddCartItemDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.cartService.addItem(user?.id, this.session(req), dto.variantId, dto.quantity);
  }

  @Public()
  @Patch('items')
  update(
    @Req() req: Request,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.cartService.setQuantity(user?.id, this.session(req), dto.variantId, dto.quantity);
  }

  @ApiBearerAuth()
  @Delete('items/:variantId')
  removeLine(
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.cartService.setQuantity(user?.id, this.session(req), variantId, 0);
  }
}
