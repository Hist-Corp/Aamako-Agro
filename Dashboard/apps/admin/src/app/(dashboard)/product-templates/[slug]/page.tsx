'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/config/auth-context';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  Globe,
  ExternalLink,
  Lock,
  CheckCircle,
  Upload,
} from 'lucide-react';
import { PRODUCT_TEMPLATE_SECTIONS, productFieldKey, ALL_PRODUCT_FIELD_KEYS } from '@/config/product-templates';

interface CmsItem {
  id: string;
  key: string;
  title: string;
  body: string;
  isPublished: boolean;
}

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:8080';

const FIELD_PLACEHOLDERS: Record<string, string> = {
  name: 'e.g. Freeze-Dried Mango',
  slug: 'e.g. fd-mango',
  badge: 'e.g. Best seller',
  price: 'e.g. 450',
  'pack': 'e.g. 50g pouch',
  availability: 'e.g. In stock',
  'shelf-life': 'e.g. 18 months, unopened',
  description: 'One-line summary...',
};

export default function ProductTemplateEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
    const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, CmsItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const slug = resolvedSlug || 'new';

  const allowed = !!user && canAct(user.role, 'product-templates:view');
  const canEdit = !!user && canAct(user.role, 'product-templates:edit');
  const canPublish =
    !!user &&
    (canAct(user.role, 'product-templates:publish') ||
      canAct(user.role, 'products:publish') ||
      canAct(user.role, 'content:publish'));

  const prefix = `product-template.${slug}.`;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<CmsItem[]>('/content/manage');
      const map: Record<string, CmsItem> = {};
      for (const item of data) {
        if (item.key.startsWith(prefix)) {
          const field = item.key.slice(prefix.length);
          if (Object.keys(map).includes(field)) {
            map[field] = item;
          } else {
            map[field] = item;
          }
        }
      }
      setItems(map);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load product template',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [slug, addToast]);

    useEffect(() => {
    const init = async () => {
      const resolved = await params;
      setResolvedSlug(resolved?.slug ?? null);
    };
    init();
  }, [params]);

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace('/dashboard');
      return;
    }
    if (slug) void load();
  }, [user, allowed, slug, load, router]);

    const updateItem = (field: string, updates: Partial<CmsItem>) => {
    const key = productFieldKey(slug, field);
    setItems((prev) => ({
      ...prev,
      [field]: {
        id: prev[field]?.id || '',
        key,
        title: updates.title ?? prev[field]?.title ?? '',
        body: updates.body ?? prev[field]?.body ?? '',
        isPublished: updates.isPublished ?? prev[field]?.isPublished ?? false,
      },
    }));
  };

  const handleSaveField = async (field: string, value: string, isTitle: boolean = true) => {
    setIsSaving(true);
    const existing = items[field];
    const key = productFieldKey(slug, field);
    try {
      await apiClient.put('/content', {
        key,
        ...(isTitle ? { title: value } : { body: value }),
        ...(existing ? { id: existing.id } : {}),
      });
      updateItem(field, isTitle ? { title: value } : { body: value });
      addToast({
        type: 'success',
        title: 'Saved',
        description: `${field} updated successfully.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Save failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    // Validate required fields before publishing — most importantly the
    // product image, which can come from either an https URL or a device upload.
    const missing: string[] = [];
    for (const section of PRODUCT_TEMPLATE_SECTIONS) {
      for (const field of section.fields) {
        if (!field.required) continue;
        const existing = items[field.key];
        const value = (existing?.title || existing?.body || '').trim();
        if (!value) missing.push(field.label);
        if (field.key === 'image-url' && value && !/^https?:\/\/.+/i.test(value)) {
          addToast({
            type: 'error',
            title: 'Invalid product image',
            description: 'The product image must be an https:// URL (paste a link or upload from your device).',
          });
          return;
        }
      }
    }
    if (missing.length > 0) {
      addToast({
        type: 'error',
        title: 'Required fields missing',
        description: `Please fill in: ${missing.join(', ')}. For the product image, paste a URL or upload one from your device.`,
      });
      setActiveSection(0);
      return;
    }
    setIsSaving(true);
    try {
      for (const field of ALL_PRODUCT_FIELD_KEYS) {
        const key = productFieldKey(slug, field);
        if (items[field]) {
          await apiClient.put('/content/publish', {
            key,
            ...(user?.role === 'CONTENT_MANAGER' || user?.role === 'STAFF_MANAGER'
              ? { status: 'PENDING_REVIEW' }
              : { status: 'PUBLISHED' }),
          });
        }
      }
      addToast({
        type: 'success',
        title: 'Published',
        description: 'Product template published successfully.',
      });
      await load();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Publish failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSaving(false);
    }
  };

    if (!user || !allowed) return null;

return (
  <div>
    <PageHeader
      title={`Product: ${slug}`}
      description="Edit any section of this product template. Changes save directly and show in the live storefront preview."
      actions={
        <div className="flex gap-2">
          {canPublish && (
            <Button variant={isSaving ? 'secondary' : 'primary'} onClick={handlePublish} disabled={isSaving}>
              <CheckCircle className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Publish to storefront'}
            </Button>
          )}
          <a href={`${STOREFRONT_URL}/product.html?slug=${slug}`} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <ExternalLink className="h-4 w-4" /> View live product page
            </Button>
          </a>
        </div>
      }
      breadcrumbs={[
        { label: 'Content', href: '/pages' },
        { label: 'Product Templates', href: '/product-templates' },
        { label: slug === 'new' ? 'Add product' : `Edit: ${slug}` },
      ]}
    />

    <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
      <Lock className="h-4 w-4 flex-shrink-0" />
      <span>
        <span className="font-medium">Restricted:</span> Only Managers, Content Managers, Admins
        and Super Admins can edit product templates.
      </span>
    </div>

    <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-6">
        {PRODUCT_TEMPLATE_SECTIONS.map((section) => (
          <Card key={section.label} className="p-5 mb-4">
            <h3 className="text-md font-semibold text-surface-800 mb-1">{section.label}</h3>
            <p className="text-2xs text-surface-500 mb-4">{section.description}</p>
            {section.fields.map((field) => renderField(field, items, slug, handleSaveField))}
          </Card>
        ))}
        <div className="text-center">
          <a href="/product-templates" className="text-sm text-brand-600">← Back to all products</a>
        </div>
      </div>

      {/* Live storefront preview */}
      <div>
        <Card className="p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-surface-700">Live storefront preview</h3>
            <a href={`${STOREFRONT_URL}/product.html?slug=${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 text-surface-400" />
            </a>
          </div>
        </Card>
        <div className="border border-surface-200 rounded-lg overflow-hidden bg-white">
          <iframe
            src={`${STOREFRONT_URL}/product.html?slug=${slug}`}
            title="Storefront preview"
            className="w-full h-[600px] border-0"
            loading="lazy"
          />
        </div>
        <p className="text-2xs text-surface-400 mt-2">
          This iframe loads the real product page. After editing content above,
          reload the preview to see changes.
        </p>
      </div>
    </div>
  </div>
  );
}

function renderField(
  field: any,
  items: Record<string, CmsItem>,
  slug: string,
  onSave: (field: string, value: string, isTitle: boolean) => void,
) {
  const existing = items[field.key];
  const fieldKey = productFieldKey(slug, field.key);

  if (field.type === 'image') {
    return (
      <ImageField
        key={field.key}
        field={field}
        value={(existing?.title ?? '').trim()}
        fieldKey={fieldKey}
        onSave={onSave}
      />
    );
  }

  if (field.type === 'textarea' || field.type === 'richtext') {
    return (
      <div key={field.key} className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}</label>
        <textarea
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          rows={4}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          value={existing?.body ?? existing?.title ?? ''}
          onChange={(e) => onSave(field.key, e.target.value, false)}
        />
        <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
        <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
      </div>
    );
  }

  if (field.type === 'number' || field.type === 'url' || field.type === 'select' || field.type === 'text') {
    return (
      <div key={field.key} className="mb-4">
        <label className="block text-xs font-medium text-surface-600 mb-1">{field.label}</label>
        {field.type === 'select' ? (
          <select
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={existing?.title ?? ''}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          >
            <option value="">Select</option>
            {field.options?.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={field.placeholder}
            value={existing?.title ?? ''}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          />
        )}
        {field.key === 'process-category' && (existing?.title ?? '').trim() && (
          <a
            href={`${STOREFRONT_URL}/collection.html?cat=${encodeURIComponent((existing?.title ?? '').trim())}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-2xs font-medium text-brand-600 hover:text-brand-700"
          >
            <ExternalLink className="h-3 w-3" /> View the {field.options?.find((o: any) => o.value === existing?.title)?.label ?? existing?.title} category page
          </a>
        )}
        <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
        <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
      </div>
    );
  }

  return null;
}

/** Product image field: paste an https:// URL OR upload an image straight
 *  from the device. Either one fills the same required image-url field. */
function ImageField({
  field,
  value,
  fieldKey,
  onSave,
}: {
  field: any;
  value: string;
  fieldKey: string;
  onSave: (field: string, value: string, isTitle: boolean) => void;
}) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP…).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large — maximum size is 5 MB.');
      return;
    }
    setUploading(true);
    try {
      const res = await apiClient.upload<{ url: string }>('/admin/media/upload', file);
      onSave(field.key, res.url, true);
      addToast({ type: 'success', title: 'Image uploaded', description: 'Saved as the product image.' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed — please try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-surface-600 mb-1">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Product preview"
            className="h-24 w-24 flex-shrink-0 rounded-lg border border-surface-200 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
          />
        ) : (
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-surface-300 text-2xs text-surface-400">
            No image
          </div>
        )}
        <div className="min-w-[240px] flex-1 space-y-2">
          <input
            type="url"
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onSave(field.key, e.target.value, true)}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Insert from device'}
            </Button>
            <span className="text-2xs text-surface-400">URL or device image — one is required</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
      </div>
      <p className="text-2xs text-surface-400 mt-1">{field.description}</p>
      <p className="text-2xs text-surface-400 mt-1">Key: <code>{fieldKey}</code></p>
    </div>
  );
}
