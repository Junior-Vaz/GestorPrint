import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { IAsaasGateway } from '../../application/billing/billing-repository.interface';
import { PlatformSettingsService } from '../../shared/platform-settings.service';

@Injectable()
export class AsaasGateway implements IAsaasGateway {
  private readonly logger = new Logger(AsaasGateway.name);

  constructor(private readonly platformSettings: PlatformSettingsService) {}

  /** Lê env do DB (com fallback no env var) — sandbox por default */
  private async getBaseUrl(): Promise<string> {
    const env = await this.platformSettings.get('asaasEnv');
    return env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }

  private async request(method: string, path: string, data?: any): Promise<any> {
    const apiKey = await this.platformSettings.get('asaasApiKey');
    if (!apiKey) throw new BadRequestException('Asaas API Key não configurada — preencha em SaaS Admin → Configurações');

    const baseUrl = await this.getBaseUrl();
    try {
      const res = await axios({
        method,
        url: `${baseUrl}${path}`,
        data,
        headers: { access_token: apiKey, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      return res.data;
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const apiErrors = axiosErr.response?.data?.errors;
      if (apiErrors?.length) {
        const messages = apiErrors.map((e: any) => e.description || e.code).join(', ');
        this.logger.error(`Asaas API error [${method} ${path}]: ${messages}`);
        throw new BadRequestException(`Asaas: ${messages}`);
      }
      const fallback = axiosErr.response?.data?.message || axiosErr.message || 'Erro na API Asaas';
      this.logger.error(`Asaas request failed [${method} ${path}]: ${fallback}`);
      throw new BadRequestException(fallback);
    }
  }

  async createCustomer(data: {
    name: string;
    cpfCnpj: string;
    email?: string;
    mobilePhone?: string;
    externalReference: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/customers', { ...data, notificationDisabled: false });
  }

  async createSubscription(data: {
    customer: string;
    billingType: string;
    value: number;
    nextDueDate: string;
    cycle: string;
    description: string;
    externalReference: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/subscriptions', {
      ...data,
      fine: { value: 2, type: 'PERCENTAGE' },
      interest: { value: 1 },
    });
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    await this.request('DELETE', `/subscriptions/${subscriptionId}`);
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    return this.request('GET', `/subscriptions/${subscriptionId}`);
  }

  async getPaymentsByCustomer(customerId: string, limit = 20): Promise<any[]> {
    const result = await this.request('GET', `/payments?customer=${customerId}&limit=${limit}`);
    return result.data || [];
  }
}
