import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CanAccess } from '../permissions/can-access.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequireFeature } from '../../../shared/decorators/require-feature.decorator';
import { FeatureKey } from '../../../domain/entitlement/feature-key.enum';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CanAccess('users', 'view')
  findAll(@CurrentTenant() tenantId: number, @Query() dto: PaginationDto) {
    return this.usersService.findAll(tenantId, dto);
  }

  @Get(':id')
  @CanAccess('users', 'view')
  findOne(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.usersService.findOne(+id, tenantId);
  }

  @Post()
  @CanAccess('users', 'create')
  create(@Body() data: CreateUserDto, @CurrentTenant() tenantId: number) {
    return this.usersService.create(data, tenantId);
  }

  @Patch(':id')
  @RequireFeature(FeatureKey.COMMISSIONS)
  @CanAccess('users', 'edit')
  update(@Param('id') id: string, @Body() data: UpdateUserDto, @CurrentTenant() tenantId: number) {
    return this.usersService.update(+id, data, tenantId);
  }

  @Delete(':id')
  @CanAccess('users', 'delete')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: number) {
    return this.usersService.remove(+id, tenantId);
  }
}
