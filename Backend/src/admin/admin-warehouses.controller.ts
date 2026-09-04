import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_READ: Role[] = [
  Role.STAFF_SUPPORT,
  Role.CONTENT_MANAGER,
  Role.STAFF_MANAGER,
  Role.STAFF_SALES,
  Role.STAFF_ADMIN,
  Role.SUPER_ADMIN,
];
const STAFF_WRITE: Role[] = [Role.STAFF_MANAGER, Role.STAFF_ADMIN, Role.SUPER_ADMIN];

@ApiBearerAuth()
@ApiTags('admin/warehouses')
@Controller('admin/warehouses')
export class AdminWarehousesController {
  constructor(private prisma: PrismaService) {}

  /** All warehouses (with live stock stats per location). */
  @Roles(...STAFF_READ)
  @Get()
  async list() {
    const warehouses = await this.prisma.warehouse.findMany({ orderBy: { createdAt: 'asc' } });
    return warehouses;
  }

  @Roles(...STAFF_WRITE)
  @Post()
  async create(@Body() body: { name?: string; code?: string; address?: string }) {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    if (!body.code?.trim()) throw new BadRequestException('code is required');
    const code = body.code.trim().toUpperCase();
    const exists = await this.prisma.warehouse.findUnique({ where: { code } });
    if (exists) throw new BadRequestException(`warehouse code ${code} already exists`);
    return this.prisma.warehouse.create({ data: { name: body.name.trim(), code, address: body.address?.trim() || null } });
  }

  @Roles(...STAFF_WRITE)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; address?: string; isActive?: boolean },
  ) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (body.name !== undefined && !body.name.trim()) throw new BadRequestException('name cannot be empty');
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.address !== undefined && { address: body.address.trim() || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
  }
}