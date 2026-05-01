import { OrderStatus } from '../../domain/orders/order.entity';
import { PaginatedResult, PaginationDto } from '../../shared/dto/pagination.dto';

export interface OrderSummary {
  id: number;
  uuid?: string | null;          // UUID público do pedido (ecommerce/refresh-payment)
  customerName: string;
  customerPhone: string | null;
  productDescription: string;
  amount: number;
  status: OrderStatus;
  salesperson: { id: number; name: string } | null;
  producer: { id: number; name: string } | null;
  createdAt: string;
  deliveryDate?: string | null;
  priority?: string;
  attachments: any[];
  transactions: any[];
  details?: any;
  estimateId?: number | null;
  estimate?: any;
  tenantId?: number;
  notes?: string | null;
  source?: string;
  // Pagamento — Kanban usa pra rotear "verificar pagamento" pelo método certo
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  paymentExternalId?: string | null;
}

export interface CreateOrderData {
  customerName: string;
  // Quando passado, sobrescreve a resolução por nome — usado por PDV/ecommerce
  // que sabem qual cliente foi selecionado e não querem lookup ambíguo.
  customerId?: number;
  productDescription: string;
  amount: number;
  isPdv?: boolean;
  paymentMethod?: string;
  salespersonId?: number | null;
  producerId?: number | null;
  details?: any;
  estimateId?: number | null;
  tenantId: number;
}

export interface IOrderRepository {
  findTenantLimits(tenantId: number): Promise<{
    maxOrders: number;
    isActive: boolean;
    planStatus: string;
  } | null>;

  countOrdersThisMonth(tenantId: number): Promise<number>;

  findOrCreateCustomer(name: string, tenantId: number): Promise<{ id: number; name: string; phone: string | null }>;

  /** Busca cliente já existente pelo ID — usado quando o frontend já tem o cliente
   *  selecionado (PDV/checkout) pra evitar ambiguidade do lookup por nome. */
  findCustomerById(customerId: number, tenantId: number): Promise<{ id: number; name: string; phone: string | null } | null>;

  createOrder(data: CreateOrderData & { customerId: number; initialStatus: OrderStatus }): Promise<OrderSummary>;

  createTransaction(data: {
    orderId: number;
    amount: number;
    status: string;
    paymentType: string;
    gatewayId: string;
  }): Promise<void>;

  findAll(tenantId: number): Promise<OrderSummary[]>;
  findAllPaginated(tenantId: number, dto: PaginationDto): Promise<PaginatedResult<OrderSummary>>;
  findOne(id: number, tenantId: number): Promise<OrderSummary | null>;
  findOneRaw(id: number, tenantId: number): Promise<any>;

  update(id: number, data: Partial<OrderSummary>): Promise<OrderSummary>;

  findPaidTransaction(orderId: number): Promise<boolean>;

  remove(id: number, tenantId: number): Promise<any>;

  /** Valida que FKs opcionais (salespersonId, producerId, estimateId) pertencem ao tenant. */
  assertFkOwnership(
    fks: { salespersonId?: number | null; producerId?: number | null; estimateId?: number | null },
    tenantId: number,
  ): Promise<void>;
}

export const ORDER_REPOSITORY = Symbol('IOrderRepository');
