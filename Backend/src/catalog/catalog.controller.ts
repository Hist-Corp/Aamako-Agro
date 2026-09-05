import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ListProductsQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Public()
  @ApiOperation({ summary: 'Paginated published products' })
  @Get('products')
  list(@Query() q: ListProductsQueryDto) {
    return this.catalog.list(q);
  }

  @Public()
  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  /** Admin picker — ALL products (incl. unpublished) for media/task pickers. */
  @ApiBearerAuth()
  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Get('admin/products')
  adminList() {
    return this.catalog.adminList();
  }

  @Public()
  @Get('products/:idOrSlug')
  detail(@Param('idOrSlug') idOrSlug: string) {
    return this.catalog.getByIdOrSlug(idOrSlug);
  }

  // ---------- Admin writes ----------
  @ApiBearerAuth()
  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Post('admin/products')
  create(@Body() dto: CreateProductDto) {
    return this.catalog.create(dto);
  }

  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Patch('admin/products/:id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.update(id, dto);
  }

  @Roles(Role.STAFF_ADMIN)
  @Delete('admin/products/:id')
  remove(@Param('id') id: string) {
    return this.catalog.remove(id);
  }

  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Post('admin/products/:id/variants')
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.catalog.addVariant(id, dto);
  }

  /** Rename a category page (display name only — slugs stay stable). */
  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Patch('admin/categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  /** Create a new product category page (Dashboard → Content → Pages →
   *  Product Category → "Add category page"). The shared collection template
   *  picks it up immediately. */
  @ApiOperation({ summary: 'Create a product category page' })
  @Roles(Role.STAFF_ADMIN, Role.STAFF_MANAGER, Role.CONTENT_MANAGER)
  @Post('admin/categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }
}
