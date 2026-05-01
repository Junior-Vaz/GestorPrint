import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

// name is readonly after creation — excluded from update
export class UpdatePlanDto extends PartialType(OmitType(CreatePlanDto, ['name'] as const)) {}
