import { requestClient } from '#/api/request';

export interface Member {
  id: number;
  userId: number | null;
  displayName: string;
  role: string;
  sortOrder: number;
}
export interface Category {
  id: number;
  code: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  sortOrder: number;
  enabled: boolean;
}
export interface AssetContext {
  userId: number;
  tenantId: number;
  family: null | {
    id: number;
    name: string;
    ownerUserId: number;
    allowViewOthers: boolean;
  };
  owner: boolean;
  currentMemberId: number;
  members: Member[];
  categories: Category[];
  maxBalance: string;
}
export interface Account {
  id?: number;
  version?: number;
  memberId: number;
  categoryCode: string;
  name: string;
  templateCode: string | null;
  balance: string | null;
  fundBucket: string | null;
  insuranceType: string | null;
  dataDate: string;
  sortOrder: number;
  remark: string;
  updatedAt?: string;
  deleted?: boolean;
}
export interface Summary {
  totalAssets: string;
  totalLiabilities: string;
  netAssets: string;
  debtRatio: string | null;
  updatedAt?: string | null;
}
export interface Snapshot extends Summary {
  date: string;
  amounts: Record<string, string>;
}
export interface UpdateRecord {
  id: number;
  accountId: number;
  accountName: string;
  memberId: number;
  categoryCode: string;
  previousBalance: string | null;
  currentBalance: string | null;
  changeAmount: string;
  operation: string;
  operatorUserId: number;
  operatorName: string | null;
  sourceType: string;
  dataDate: string;
  createdAt: string;
}
export interface HistoryPage {
  list: UpdateRecord[];
  total: number;
}
export interface Dashboard {
  overview: Summary;
  monthly: Summary & {
    firstRecord: boolean;
    baselineDate: string | null;
    categories: Record<string, string>;
  };
  composition: (Category & { amount: string; ratio: string })[];
  buckets: Record<string, string>;
  insuranceTypes: string[];
  accountCount: number;
  trends: Snapshot[];
  records: HistoryPage;
}
const root = '/finance/assets';
export const getAssetContext = () =>
  requestClient.get<AssetContext>(`${root}/context`);
export const initializeFamily = (name: string) =>
  requestClient.post(`${root}/initialize`, { name, allowViewOthers: false });
export const saveFamily = (data: { name: string; allowViewOthers: boolean }) =>
  requestClient.put(`${root}/family`, data);
export const saveMember = (data: Partial<Member>) =>
  requestClient.put(`${root}/member`, data);
export const deleteMember = (id: number) =>
  requestClient.delete(`${root}/member`, { params: { id } });
export const saveCategory = (data: Category) =>
  requestClient.put(`${root}/category`, data);
export const getAssetAccounts = (
  params: { memberId?: number; category?: string } = {},
) => requestClient.get<Account[]>(`${root}/accounts`, { params });
export const getAssetDashboard = (params: {
  memberId?: number;
  excludeFixed: boolean;
}) => requestClient.get<Dashboard>(`${root}/dashboard`, { params });
export const getAssetHistory = (params: {
  memberId?: number;
  category?: string;
  start?: string;
  end?: string;
  page: number;
  size: number;
}) => requestClient.get<HistoryPage>(`${root}/history`, { params });
export const submitAssets = (data: {
  requestId: string;
  updateDate: string;
  accounts: Account[];
}) => requestClient.post<number>(`${root}/submit`, data);
