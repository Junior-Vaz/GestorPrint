import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // Any authenticated user can list available plans (for upgrade UI)
  @Get()
  findAll() {
    return this.plansService.findAll();
  }

  // Returns the current tenant's plan features + usage — used by tenant frontend
  @Get('my')
  getMyPlan(@CurrentTenant() tenantId: number) {
    return this.plansService.getMyPlan(tenantId);
  }

  // Admin: view a specific plan by id
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.plansService.deactivate(id);
  }
}
