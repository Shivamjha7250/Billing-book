export type UserRole = "user" | "admin";

export type Company = {
  id: string;
  name: string;
  logo: string;
  address: string;
  email: string;
  phone: string;

  upiId: string;

  bankName: string;
  accountNumber: string;
  ifscCode: string;
  bankLogo: string;

  gstNumber?: string;
  invoicePrefix: string;

  theme: "light" | "dark";
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
};

export type Customer = {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  gstNumber?: string;
};

export type Service = {
  id: string;
  companyId: string;
  name: string;
  price?: number;
  gstRate: number;
  active: boolean;
};

export type BillItem = {
  id: string;
  serviceId?: string;
  serviceName: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type Invoice = {
  id: string;
  companyId: string;
  invoiceNumber: string;

  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;

  items: BillItem[];

  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;

  paymentStatus: "paid" | "pending" | "partial";

  createdAt: string;
};

export type ReportPeriod =
  | "month"
  | "six_months"
  | "one_year"
  | "custom";