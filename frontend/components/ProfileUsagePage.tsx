import React from 'react';
import { User, Account } from '../../shared/types';
import { UsageMeter } from './UsageMeter';

interface ProfileUsagePageProps {
  user: User;
  account: Account;
}

export const ProfileUsagePage: React.FC<ProfileUsagePageProps> = ({ user, account }) => {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      {/* Page Header */}
      <div className="px-8 pt-8 pb-4">
        <p className="eyebrow mb-1">My Usage</p>
        <h1 className="font-serif italic text-3xl font-normal text-ink tracking-tight">Your Usage</h1>
        <p className="text-sm text-ink-3 mt-1">Track your query volume, remaining allocation, cost per query, and domain utilization</p>
      </div>

      <div className="px-8 pb-8 max-w-5xl">
        <UsageMeter user={user} account={account} />
      </div>
    </div>
  );
};
