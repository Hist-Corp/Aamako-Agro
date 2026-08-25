'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Leaf, Shield, Users, BarChart3, Package, Star, MessageSquare, Settings } from 'lucide-react';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access', icon: Settings, color: 'bg-purple-500', email: 'superadmin@aamako.com' },
  { value: 'ADMIN', label: 'Admin', description: 'Second-level administrator', icon: Shield, color: 'bg-blue-500', email: 'admin@aamako.com' },
  { value: 'MANAGER', label: 'Manager', description: 'Business operations', icon: Users, color: 'bg-green-500', email: 'manager@aamako.com' },
  { value: 'SALES', label: 'Sales', description: 'Sales & wholesale', icon: BarChart3, color: 'bg-cyan-500', email: 'sales@aamako.com' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Mgr', description: 'Warehouse & distribution', icon: Package, color: 'bg-amber-500', email: 'inventory@aamako.com' },
  { value: 'CONTENT_MANAGER', label: 'Content Mgr', description: 'CMS & content', icon: Star, color: 'bg-pink-500', email: 'content@aamako.com' },
  { value: 'CUSTOMER_SUPPORT', label: 'Support', description: 'Customer support', icon: MessageSquare, color: 'bg-indigo-500', email: 'support@aamako.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email.trim() || !password) {
        setError('Please enter your email and password.');
        return;
      }
      await login(email.trim(), password, showTotp ? totpCode : undefined);
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.status === 401 && err?.data?.requiresMfa) {
        setShowTotp(true);
      } else {
        setError(err?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden login-bg">
      {/* Agro-themed background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900" />
      
      {/* Decorative leaf pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Large background leaves */}
          <g fill="currentColor" className="text-white">
            <path d="M10,20 Q15,10 20,15 Q15,25 10,20" opacity="0.3" />
            <path d="M80,10 Q85,5 90,10 Q85,15 80,10" opacity="0.2" />
            <path d="M5,50 Q10,40 15,45 Q10,55 5,50" opacity="0.25" />
            <path d="M85,80 Q90,70 95,75 Q90,85 85,80" opacity="0.2" />
            <path d="M50,5 Q55,0 60,5 Q55,10 50,5" opacity="0.3" />
            <path d="M30,90 Q35,80 40,85 Q35,95 30,90" opacity="0.2" />
            <path d="M70,60 Q75,50 80,55 Q75,65 70,60" opacity="0.15" />
            <path d="M20,70 Q25,60 30,65 Q25,75 20,70" opacity="0.2" />
            <path d="M60,30 Q65,20 70,25 Q65,35 60,30" opacity="0.25" />
            <path d="M40,40 Q45,30 50,35 Q45,45 40,40" opacity="0.2" />
          </g>
        </svg>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4 shadow-lg border border-white/30">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">आमाको एग्रो</h1>
          <p className="text-sm text-green-100 mt-1 font-medium">Admin Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-white/20 p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-surface-900 mb-5">Sign in</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selector */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Sign in as</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setSelectedRole(role.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${
                        selectedRole === role.value
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                          : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${role.color} flex-shrink-0`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-900 truncate">{role.label}</p>
                        <p className="text-2xs text-surface-500 truncate">{role.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Email"
              type="email"
              placeholder={`${selectedRole.toLowerCase()}@aamako.com`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {showTotp && (
              <Input
                label="Authenticator Code"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
                maxLength={6}
                inputMode="numeric"
              />
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button type="submit" isLoading={isLoading} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5">
              Sign in as {ROLES.find(r => r.value === selectedRole)?.label}
            </Button>

          </form>
        </div>

        <p className="text-center text-xs text-green-200/60 mt-6">
          Access restricted to authorized personnel only.
        </p>
      </div>

      <style jsx>{`
        .login-bg {
          min-height: 100vh;
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          animation: float 20s infinite ease-in-out;
        }
        .particle-1 {
          width: 300px;
          height: 300px;
          top: -100px;
          right: -100px;
          animation-delay: 0s;
        }
        .particle-2 {
          width: 200px;
          height: 200px;
          bottom: -50px;
          left: -50px;
          animation-delay: -7s;
        }
        .particle-3 {
          width: 150px;
          height: 150px;
          top: 50%;
          left: 10%;
          animation-delay: -14s;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
}
