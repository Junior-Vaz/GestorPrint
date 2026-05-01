import { Injectable } from '@nestjs/common';
import { ManagePlanUseCase } from '../../../application/plans/manage-plan.usecase';
import { GetMyPlanUseCase } from '../../../application/plans/get-my-plan.usecase';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly managePlan: ManagePlanUseCase,
    private readonly getMyPlan: GetMyPlanUseCase,
  ) {}

  findAll() { return this.managePlan.findAll(); }
  findOne(id: number) { return this.managePlan.findOne(id); }
  create(dto: CreatePlanDto) { return this.managePlan.create(dto as any); }
  update(id: number, dto: UpdatePlanDto) { return this.managePlan.update(id, dto as any); }
  deactivate(id: number) { return this.managePlan.deactivate(id); }
  getMyPlanData(tenantId: number) { return this.getMyPlan.execute(tenantId); }
}
