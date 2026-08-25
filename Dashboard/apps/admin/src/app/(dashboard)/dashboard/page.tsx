'use client';

import React from 'react';
import { useOverview } from '@/lib/api-hooks';
import { useAuth } from '@/config/auth-context';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { KPICard } from '@/components/dashboard/kpi-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { FulfillmentPipeline } from '@/components/dashboard/fulfillment-pipeline';
import { KPISkeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart,
  DollarSign,
  Building2,
  Package,
  Users,
  MessageSquare,
  AlertTriangle,
  Star,
  Headphones,
  FileText,
  Eye,
  Truck,
  Warehouse,
} from 'lucide-react';

/** Screen: Dashboard / Overview
 *  Roles that can view: ALL (everyone with dashboard:view)
 *  Shows role-specific KPIs and widgets
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: kpis, isLoading } = useOverview();

  // Role-specific welcome message
  const getWelcomeMessage = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return 'System overview and key metrics';
      case 'ADMIN':
        return 'Operations overview and pending tasks';
      case 'MANAGER':
        return 'Business performance and team activity';
      case 'SALES':
        return 'Sales performance and customer activity';
      case 'INVENTORY_MANAGER':
        return 'Stock levels and warehouse operations';
      case 'CONTENT_MANAGER':
        return 'Content status and publishing queue';
      case 'CUSTOMER_SUPPORT':
        return 'Support tickets and customer issues';
      default:
        return 'What needs your attention right now';
    }
  };

  // Role-specific KPI cards
  const getRoleKPIs = () => {
    if (!kpis) return null;

    switch (user?.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Orders Today"
                value={formatNumber(kpis.ordersToday)}
                change={kpis.ordersTodayChange}
                icon={ShoppingCart}
              />
              <KPICard
                title="Revenue Today"
                value={formatCurrency(kpis.revenueToday)}
                change={kpis.revenueTodayChange}
                icon={DollarSign}
              />
              <KPICard
                title="Pending Approvals"
                value={formatNumber(kpis.pendingWholesaleApprovals)}
                icon={Building2}
                urgent={kpis.pendingWholesaleApprovals > 0}
              />
              <KPICard
                title="Low Stock Alerts"
                value={formatNumber(kpis.lowStockAlerts)}
                icon={AlertTriangle}
                urgent={kpis.lowStockAlerts > 0}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard
                title="Open Quotes"
                value={formatNumber(kpis.openQuotes)}
                icon={MessageSquare}
              />
              <KPICard
                title="Pending Reviews"
                value={formatNumber(kpis.pendingReviews)}
                icon={Star}
              />
              <KPICard
                title="Active Products"
                value={formatNumber(kpis.activeProducts)}
                icon={Package}
              />
            </div>
          </>
        );

      case 'MANAGER':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Orders Today"
                value={formatNumber(kpis.ordersToday)}
                change={kpis.ordersTodayChange}
                icon={ShoppingCart}
              />
              <KPICard
                title="Revenue Today"
                value={formatCurrency(kpis.revenueToday)}
                change={kpis.revenueTodayChange}
                icon={DollarSign}
              />
              <KPICard
                title="Low Stock Alerts"
                value={formatNumber(kpis.lowStockAlerts)}
                icon={AlertTriangle}
                urgent={kpis.lowStockAlerts > 0}
              />
              <KPICard
                title="Active Products"
                value={formatNumber(kpis.activeProducts)}
                icon={Package}
              />
            </div>
          </>
        );

      case 'SALES':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Orders Today"
                value={formatNumber(kpis.ordersToday)}
                change={kpis.ordersTodayChange}
                icon={ShoppingCart}
              />
              <KPICard
                title="Revenue Today"
                value={formatCurrency(kpis.revenueToday)}
                change={kpis.revenueTodayChange}
                icon={DollarSign}
              />
              <KPICard
                title="Open Quotes"
                value={formatNumber(kpis.openQuotes)}
                icon={MessageSquare}
              />
              <KPICard
                title="Total Customers"
                value={formatNumber(kpis.totalCustomers)}
                icon={Users}
              />
            </div>
          </>
        );

      case 'INVENTORY_MANAGER':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Low Stock Alerts"
                value={formatNumber(kpis.lowStockAlerts)}
                icon={AlertTriangle}
                urgent={kpis.lowStockAlerts > 0}
              />
              <KPICard
                title="Active Products"
                value={formatNumber(kpis.activeProducts)}
                icon={Package}
              />
              <KPICard
                title="Warehouses"
                value="4"
                icon={Warehouse}
              />
              <KPICard
                title="Pending Transfers"
                value="2"
                icon={Truck}
              />
            </div>
          </>
        );

      case 'CONTENT_MANAGER':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Pending Reviews"
                value={formatNumber(kpis.pendingReviews)}
                icon={Star}
              />
              <KPICard
                title="Active Products"
                value={formatNumber(kpis.activeProducts)}
                icon={Package}
              />
              <KPICard
                title="Draft Content"
                value="3"
                icon={FileText}
              />
              <KPICard
                title="Published"
                value="12"
                icon={FileText}
              />
            </div>
          </>
        );

      case 'CUSTOMER_SUPPORT':
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Open Tickets"
                value="5"
                icon={Headphones}
                urgent
              />
              <KPICard
                title="Urgent Issues"
                value="1"
                icon={AlertTriangle}
                urgent
              />
              <KPICard
                title="Resolved Today"
                value="8"
                icon={Headphones}
              />
              <KPICard
                title="Avg Response Time"
                value="2.4h"
                icon={Headphones}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={getWelcomeMessage()}
      />

      {/* Role-specific KPI Cards */}
      {isLoading ? (
        <KPISkeleton />
      ) : (
        getRoleKPIs()
      )}

      {/* Fulfillment Pipeline - only for roles that manage orders */}
      {user?.role !== 'CONTENT_MANAGER' && user?.role !== 'CUSTOMER_SUPPORT' && (
        <FulfillmentPipeline />
      )}

      {/* Activity Feed */}
      <ActivityFeed />
    </div>
  );
}
