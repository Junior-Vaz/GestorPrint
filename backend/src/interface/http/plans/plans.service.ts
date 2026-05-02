import { Injectable } from '@nestjs/common';
import { ManagePlanUseCase } from '../../../application/plans/manage-plan.usecase';
import { GetMyPlanUseCase } from '../../../application/plans/get-my-plan.usecase';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuditService } from '../audit/audit.service';

/**
 * PlansService — alterações em PlanConfig são feitas pelo super admin pela
 * UI do SaaS Admin. tenantId=1 nos audit logs (gh ost da plataforma) porque
 * PlanConfig não pertence a um tenant específico — afeta TODOS os tenants
 * que estão naquele plano. Crítico pra rastreabilidade da plataforma.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly managePlan: ManagePlanUseCase,
    private readonly getMyPlan: GetMyPlanUseCase,
    private readonly audit: AuditService,
  ) {}

  findAll() { return this.managePlan.findAll(); }
  findOne(id: number) { return this.managePlan.findOne(id); }

  async create(dto: CreatePlanDto) {
    const result = await this.managePlan.create(dto as any);
    await this.audit.logAction(
      null, 'CREATE', 'PlanConfig', (result as any)?.id,
      { name: (dto as any).name, price: (dto as any).price },
      1,
    );
    return result;
  }

  async update(id: number, dto: UpdatePlanDto) {
    const result = await this.managePlan.update(id, dto as any);
    await this.audit.logAction(
      null, 'UPDATE', 'PlanConfig', id,
      { changedFields: Object.keys(dto || {}), price: (dto as any)?.price },
      1,
    );
    return result;
  }

  async deactivate(id: number) {
    const result = await this.managePlan.deactivate(id);
    await this.audit.logAction(null, 'DEACTIVATE', 'PlanConfig', id, {}, 1);
    return result;
  }

  getMyPlanData(tenantId: number) { return this.getMyPlan.execute(tenantId); }
}
