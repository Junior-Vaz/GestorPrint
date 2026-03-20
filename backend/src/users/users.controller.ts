import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: number) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.usersService.findOne(+id, tenantId);
  }

  @Post()
  create(@Body() data: CreateUserDto, @CurrentTenant() tenantId: number) {
    return this.usersService.create(data, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateUserDto, @CurrentTenant() tenantId: number) {
    return this.usersService.update(+id, data, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.usersService.remove(+id, tenantId);
  }
}
