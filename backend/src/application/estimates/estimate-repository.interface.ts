export interface EstimateData {
  id: number;
  tenantId: number;
  customerId: number;
  salespersonId?: number | null;
  estimateType: string;
  totalPrice: number;
  status: string;
  details: any;
  createdAt: Date;
  customer: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

import { PaginatedResult, PaginationDto } from '../../shared/dto/pagination.dto';

export interface IEstimateRepository {
  findAll(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<EstimateData>>;
  findOne(id: number, tenantId: number): Promise<EstimateData | null>;
  findWithOrders(id: number, tenantId: number): Promise<EstimateData & { orders: { id: number }[] } | null>;
  updateStatus(id: number, status: string): Promise<void>;
  createOrder(data: {
    customerId: number;
    estimateId: number;
    salespersonId?: number | null;
    tenantId: number;
    productDescription: string;
    amount: number;
    status: string;
  }): Promise<{ id: number; createdAt: Date; amount: any; status: string; productDescription: string }>;

  migrateAttachments(estimateId: number, orderId: number): Promise<number>;
}

export const ESTIMATE_REPOSITORY = Symbol('IEstimateRepository');
