'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { relativeTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { apiClient, ApiError } from '@/lib/api-client';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import {
  FileImage,
  FileVideo,
  File,
  Upload,
  Trash2,
  Pencil,
  Globe,
  RotateCcw,
  PackagePlus,
  Image as ImageIcon,
} from 'lucide-react';

interface MediaItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  altText: string | null;
  category: string;
  size: string | null;
  dimensions: string | null;
  isPublished: boolean;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  isPublished: boolean;
}

const TYPE_ICONS: Record<string, typeof ImageIcon> = {
  IMAGE: FileImage,
  VIDEO: FileVideo,
  DOCUMENT: File,
};

const CATEGORY_PRESETS = ['Product', 'Homepage', 'Banner', 'Journal', 'Team', 'Wholesale', 'General'];

/** Screen: Media Library — real API-backed.
 *  Content Manager has full rights: add (by URL), edit/replace/customize
 *  (name, alt text, category, URL), publish/unpublish, and instantly apply
 *  any image to a product's image without a long product-editing flow. */
export default function MediaPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const canEdit = !!user && canAct(user.role, 'media:edit');
  const canPublish = !!user && canAct(user.role, 'media:publish');
  const canUpload = !!user && canAct(user.role, 'media:upload');
  const canDelete = !!user && canAct(user.role, 'media:delete');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<MediaItem[]>('/admin/media');
      setMedia(data);
      const cats = await apiClient.get<string[]>('/admin/media/categories');
      setCategories(cats);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Could not load media',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      media.filter((m) => {
        if (typeFilter && m.type !== typeFilter) return false;
        if (categoryFilter && m.category !== categoryFilter) return false;
        return true;
      }),
    [media, typeFilter, categoryFilter],
  );

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    media.forEach((m) => { map[m.category] = (map[m.category] ?? 0) + 1; });
    return map;
  }, [media]);

  const typeOptions = [
    { value: '', label: 'All Files' },
    { value: 'IMAGE', label: 'Images' },
    { value: 'VIDEO', label: 'Videos' },
    { value: 'DOCUMENT', label: 'Documents' },
  ];

  const categoryChips = useMemo(
    () => ['', ...Array.from(new Set(['General', ...categories])).sort()],
    [categories],
  );

  // ── Upload (add by URL) dialog ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', url: '', category: 'Product', altText: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleUpload = async () => {
    if (!uploadForm.name.trim() || !uploadForm.url.trim()) {
      addToast({ type: 'error', title: 'Name and URL required', description: 'Provide an image name and https:// URL.' });
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.post('/admin/media', {
        name: uploadForm.name.trim(),
        url: uploadForm.url.trim(),
        category: uploadForm.category,
        altText: uploadForm.altText.trim(),
      });
      addToast({ type: 'success', title: 'Image added', description: 'Published to the media library.' });
      setUploadOpen(false);
      setUploadForm({ name: '', url: '', category: 'Product', altText: '' });
      await load();
    } catch (err) {
      addToast({ type: 'error', title: 'Upload failed', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit / customize dialog ──
  const [editTarget, setEditTarget] = useState<MediaItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', category: 'General', altText: '' });

  const openEdit = (item: MediaItem) => {
    setEditTarget(item);
    setEditForm({
      name: item.name,
      url: item.url,
      category: item.category,
      altText: item.altText ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setIsSaving(true);
    try {
      await apiClient.patch(`/admin/media/${editTarget.id}`, {
        name: editForm.name.trim(),
        url: editForm.url.trim(),
        category: editForm.category,
        altText: editForm.altText.trim(),
      });
      addToast({ type: 'success', title: 'Image updated', description: editForm.name?.trim() || editTarget.name });
      setEditTarget(null);
      await load();
    } catch (err) {
      addToast({ type: 'error', title: 'Update failed', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Publish / unpublish ──
  const handleTogglePublish = async (item: MediaItem) => {
    setIsSaving(true);
    try {
      await apiClient.post(`/admin/media/${item.id}/${item.isPublished ? 'unpublish' : 'publish'}`);
      addToast({
        type: 'success',
        title: item.isPublished ? 'Image unpublished' : 'Image published',
        description: item.name,
      });
      await load();
    } catch (err) {
      addToast({ type: 'error', title: 'Action failed', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ──
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await apiClient.delete(`/admin/media/${deleteTarget.id}`);
      addToast({ type: 'success', title: 'Image deleted', description: deleteTarget.name });
      setDeleteTarget(null);
      await load();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Use for a product (one-step image swap) ──
  const [productPicker, setProductPicker] = useState<MediaItem | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [pickProductId, setPickProductId] = useState('');

  const openProductPicker = async (item: MediaItem) => {
    setProductPicker(item);
    setPickProductId('');
    try {
      const list = await apiClient.get<AdminProduct[]>('/admin/products');
      setProducts(list);
    } catch (err) {
      addToast({ type: 'error', title: 'Could not load products', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    }
  };

  const handleApplyToProduct = async () => {
    if (!productPicker || !pickProductId) {
      addToast({ type: 'error', title: 'Select a product', description: 'Choose which product to update.' });
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.patch(`/admin/products/${pickProductId}`, { imageUrl: productPicker.url });
      addToast({ type: 'success', title: 'Product image updated', description: 'The product now uses this media image.' });
      setProductPicker(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Apply failed', description: err instanceof ApiError ? err.message : 'Unexpected error' });
    } finally {
      setIsSaving(false);
    }
  };

  const chip = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
    (active ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description="Add, categorize, edit, replace and publish images — then drop any image onto a product in one step."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Media' }]}
        actions={
          canUpload ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" /> Add Image
            </Button>
          ) : undefined
        }
      />

      {/* Category chips */}
      <div className="flex flex-wrap items-center gap-2">
        {categoryChips.map((c) => (
          <button
            key={c || 'all'}
            className={chip(categoryFilter === c)}
            onClick={() => setCategoryFilter(c)}
          >
            {c || 'All'} {c ? `(${categoryCounts[c] ?? 0})` : `(${media.length})`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Select options={typeOptions} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-48" />
      </div>

      {/* Media grid */}
      {isLoading ? (
        <div className="py-16 text-center text-sm text-surface-500">Loading media…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No media files"
          description="Add an image by URL to start building your library — then use it anywhere."
          action={canUpload ? { label: 'Add Image', onClick: () => setUploadOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="group relative overflow-hidden">
              <div className="aspect-square bg-surface-100 flex items-center justify-center overflow-hidden">
                {item.type === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.altText ?? item.name} className="h-full w-full object-cover" />
                ) : (
                  (() => {
                    const Icon = TYPE_ICONS[item.type] ?? File;
                    return <Icon className="h-12 w-12 text-surface-300" />;
                  })()
                )}
                {!item.isPublished && (
                  <span className="absolute top-2 left-2 rounded-full bg-surface-900/80 px-2 py-0.5 text-2xs text-white">
                    UNPUBLISHED
                  </span>
                )}
              </div>

              <div className="p-3">
                <p className="text-sm font-medium text-surface-900 truncate">{item.name}</p>
                <p className="text-2xs text-surface-500">{item.size ?? item.type}</p>
                <Badge variant="neutral" className="mt-1.5 text-2xs">{item.category}</Badge>
                <p className="mt-1 text-2xs text-surface-400">{relativeTime(item.createdAt)}</p>
              </div>

              {/* Actions */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.type === 'IMAGE' && canEdit && (
                  <Button variant="ghost" size="sm" className="bg-white/90 shadow-sm" title="Use for a product (replace product image)" onClick={() => openProductPicker(item)}>
                    <PackagePlus className="h-3.5 w-3.5 text-brand-600" />
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" className="bg-white/90 shadow-sm" title="Edit / customize image" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canPublish && (
                  <Button variant="ghost" size="sm" className="bg-white/90 shadow-sm" title={item.isPublished ? 'Unpublish image' : 'Publish image'} onClick={() => handleTogglePublish(item)}>
                    {item.isPublished ? <RotateCcw className="h-3.5 w-3.5 text-amber-600" /> : <Globe className="h-3.5 w-3.5 text-green-600" />}
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" className="bg-white/90 shadow-sm" title="Delete image" onClick={() => setDeleteTarget(item)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
{/* Add image (by URL) dialog */}
      {uploadOpen && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => setUploadOpen(false)}
          title="Add image"
          description="Paste an image URL to add it to the library. It is published immediately and categorized for easy reuse."
          primaryAction={{ label: 'Add Image', onClick: handleUpload, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <Input
              label="File name *"
              value={uploadForm.name}
              onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
              placeholder="e.g. basmati-rice.jpg"
            />
            <Input
              label="Image URL *"
              value={uploadForm.url}
              onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Category"
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                options={CATEGORY_PRESETS.map((c) => ({ value: c, label: c }))}
              />
              <Input
                label="Alt text"
                value={uploadForm.altText}
                onChange={(e) => setUploadForm({ ...uploadForm, altText: e.target.value })}
                placeholder="Accessible description"
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* Edit / customize image dialog */}
      {editTarget && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => setEditTarget(null)}
          title="Edit image"
          description="Change the name, replace the image URL, or update its category and alt text."
          primaryAction={{ label: 'Save Changes', onClick: handleSaveEdit, isLoading: isSaving }}
        >
          <div className="space-y-4">
            <Input
              label="File name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <Input
              label="Image URL (replace to change the image)"
              value={editForm.url}
              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Category"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                options={CATEGORY_PRESETS.map((c) => ({ value: c, label: c }))}
              />
              <Input
                label="Alt text"
                value={editForm.altText}
                onChange={(e) => setEditForm({ ...editForm, altText: e.target.value })}
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* Use for a product dialog — one-step image replacement */}
      {productPicker && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => setProductPicker(null)}
          title="Replace a product image"
          description="Pick a product — its image will be set to this media image immediately. No product editing required."
          primaryAction={{ label: 'Apply Image', onClick: handleApplyToProduct, isLoading: isSaving }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm mb-4">
            <p className="font-medium">Using image:</p>
            <p className="text-surface-500 truncate">{productPicker.name}</p>
          </div>
          <Select
            label="Product"
            value={pickProductId}
            onChange={(e) => setPickProductId(e.target.value)}
            options={[
              { value: '', label: 'Select a product…' },
              ...products.map((p) => ({ value: p.id, label: `${p.name}${p.isPublished ? '' : ' (unpublished)'}` })),
            ]}
          />
        </Dialog>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete image?"
          description="This permanently removes the file from the media library."
          primaryAction={{ label: 'Delete', onClick: handleDelete, isLoading: isSaving }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">File:</span> {deleteTarget.name}</p>
            <p><span className="font-medium">Category:</span> {deleteTarget.category}</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}