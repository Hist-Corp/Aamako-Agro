import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const INVENTORY_ROLES = [
  Role.STAFF_SUPPORT,
  Role.STAFF_MANAGER,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
const MANAGE_ROLES = [Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

class CreateWarehouseDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) code!: string;
  @IsOptional() @IsString() address?: string;
}

class UpdateWarehouseDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiBearerAuth()
@ApiTags('admin/warehouses')
@Controller('admin/warehouses')
export class AdminWarehousesController {
  constructor(private prisma: PrismaService) {}

  @Roles(...INVENTORY_ROLES)
  @Get()
  async list() {
    const warehouses = await this.prisma.warehouse.findMany({ orderBy: { createdAt: 'asc' } });
    // Attach lightweight stock stats per warehouse (overall inventory view).
    const inventory = await this.prisma.inventory.findMany({
      include: { variant: { select: { name: true, basePriceCents: true } } },
    });
    const stats = warehouses.map((w) => {
      // No per-warehouse stock assignment yet — report global totals on each.
      const totalStock = inventory.reduce((s, i) => s + i.stockOnHand, 0);
      const lowStock = inventory.filter((i) => i.stockOnHand <= i.lowStockThreshold).length;
      const value = inventory.reduce((s, i) => s + i.stockOnHand * (i.variant.basePriceCents / 100), 0);
      return {
        warehouseId: w.id,
        totalProducts: inventory.length,
        totalStock,
        lowStock,
        value,
      };
    });
    return warehouses.map((w, i) => ({
      ...w,
      stats: stats[i],
    }));
  }

  @Roles(...MANAGE_ROLES)
  @Post()
  async create(@Body() dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: { name: dto.name, code: dto.code.toUpperCase(), address: dto.address },
    });
  }

  @Roles(...MANAGE_ROLES)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Warehouse not found');
    return this.prisma.warehouse.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...(dto.address !== undefined ? { address: dto.address } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
    });
  }
}