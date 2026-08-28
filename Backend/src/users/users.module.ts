import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { RbacPermissionsController } from './roles-permissions.controller';

@Module({
  controllers: [UsersController, AdminUsersController, AdminCustomersController, RbacPermissionsController],
})
export class UsersModule {}


