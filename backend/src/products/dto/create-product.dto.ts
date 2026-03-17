export class CreateProductDto {
  name: string;
  typeId: number;
  unitPrice: number;
  unit?: string;
  brand?: string;
  markup?: number;
  stock?: number;
  minStock?: number;
  description?: string;
  supplierId?: number;
}
