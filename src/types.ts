/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  specs: string;
  imageUrl: string;
  link: string;
}

export interface AIAnalysisResult {
  productName: string;
  category: string;
  specs: string;
  confidence: number; // e.g. 85 for 85%
  equivalentCode?: string; // SKUs or product codes
  suggestions: Product[]; // Matched products from the ZKH database
}

export interface RFQInquiry {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  taxCode?: string;
  quantity: number;
  notes?: string;
  imageUrl: string; // Base64 representation of uploaded image for persistence
  aiAnalysis: AIAnalysisResult | null;
  status: 'new' | 'quoting' | 'closed' | 'unsuitable';
  assignedStaff: string;
  createdAt: string;
}

export interface ZaloLog {
  id: string;
  timestamp: string;
  inquiryId: string;
  payload: any;
  status: 'success' | 'failed' | 'simulated';
  error?: string;
}

export interface ZaloConfig {
  webhookUrl: string;
  isEnabled: boolean;
}

