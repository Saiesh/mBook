// Type definitions for the application

export interface Measurement {
  id: string;
  clientName: string;
  location: string;
  length?: number;
  width?: number;
  area?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LLMRequest {
  prompt: string;
  data?: any;
}

export interface LLMResponse {
  success: boolean;
  response: string;
  analysis?: any;
  error?: string;
}

export interface PricingConfig {
  id: string;
  serviceType: string;
  ratePerSqFt: number;
  minimumCharge: number;
  active: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}
