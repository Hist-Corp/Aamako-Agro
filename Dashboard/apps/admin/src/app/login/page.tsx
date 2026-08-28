'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Users, BarChart3, Package, Star, MessageSquare, Settings, Eye, EyeOff } from 'lucide-react';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', description: 'Full system access', icon: Settings, color: 'bg-purple-500', email: 'admin@aamako.agro' },
  { value: 'STAFF_ADMIN', label: 'Admin', description: 'Second-level administrator', icon: Shield, color: 'bg-blue-500', email: 'admin2@aamako.agro' },
  { value: 'STAFF_MANAGER', label: 'Manager', description: 'Business operations', icon: Users, color: 'bg-green-500', email: 'manager@aamako.agro' },
  { value: 'STAFF_SALES', label: 'Sales', description: 'Sales & wholesale', icon: BarChart3, color: 'bg-cyan-500', email: 'sales@aamako.agro' },
  { value: 'STAFF_MANAGER', label: 'Inventory Mgr', description: 'Warehouse & distribution', icon: Package, color: 'bg-amber-500', email: 'inventory@aamako.agro' },
  { value: 'CONTENT_MANAGER', label: 'Content Mgr', description: 'CMS & content', icon: Star, color: 'bg-pink-500', email: 'content@aamako.agro' },
  { value: 'STAFF_SUPPORT', label: 'Support', description: 'Customer support', icon: MessageSquare, color: 'bg-indigo-500', email: 'support@aamako.agro' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('SUPER_ADMIN');
  const [totpCode, setTotpCode] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden login-bg"
      style={{ backgroundColor: '#101812', minHeight: '100vh' }}
    >
      {/* Brand background — deep forest base with lime glows straight from the logo */}
      <div className="absolute inset-0 brand-bg" />
      
      {/* Brand watermark — the logo butterfly, echoed large and faint */}
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        className="absolute -right-28 -bottom-28 w-[520px] max-w-none opacity-[0.08] pointer-events-none select-none"
      />
      <img
        src="/logo-mark.png"
        alt=""
        aria-hidden="true"
        className="absolute -left-24 -top-24 w-[340px] max-w-none opacity-[0.06] pointer-events-none select-none"
      />

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
          <img
            src="/logo.png"
            alt="Aama ko Agro"
            className="h-24 w-24 mb-4 object-contain drop-shadow-[0_14px_35px_rgba(0,0,0,0.45)]"
          />
          <h1 className="text-2xl font-bold text-white tracking-tight">आमाको एग्रो</h1>
          <p className="text-sm text-green-100 mt-1 font-medium">Centeral Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 ring-1 ring-black/5 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.65)]">
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

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-9 flex h-6 w-6 items-center justify-center rounded-md text-surface-400 transition-colors hover:text-surface-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

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
        .brand-bg {
          background:
            radial-gradient(900px 620px at 10% -8%, rgba(180, 236, 106, 0.16), transparent 60%),
            radial-gradient(820px 600px at 108% 108%, rgba(74, 222, 128, 0.14), transparent 55%),
            radial-gradient(1200px 800px at 50% 125%, rgba(0, 0, 0, 0.4), transparent 62%),
            linear-gradient(150deg, #20291f 0%, #182219 45%, #101812 100%);
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
