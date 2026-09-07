'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { relativeTime, cn } from '@/lib/utils';
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
  FileText,
  Upload,
  Trash2,
  Pencil,
  Globe,
  RotateCcw,
  PackagePlus,
  Image as ImageIcon,
  X,
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
  /** Where the file entered the library from (dashboard page/section upload). */
  sourcePage: string | null;
  sourceSection: string | null;
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
 *  Content Manager has full rights: add (from device via browse/drag & drop,
 *  or by URL), edit/replace/customize (name, alt text, category, URL),
 *  publish/unpublish, and instantly apply any image to a product's image
 *  without a long product-editing flow. */
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

  // ── Upload dialog: from device (browse / drag & drop) or by URL ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'device' | 'url'>('device');
  const [uploadForm, setUploadForm] = useState({ name: '', url: '', category: 'Product', altText: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Device-upload state
  interface PickedFile { file: File; preview: string; }
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Tracks nested dragenter/dragleave pairs so the highlight doesn't flicker
  // when the pointer crosses child elements inside the drop zone.
  const dragDepth = useRef(0);
  const MAX_UPLOAD_MB = 5;

  const openUpload = () => {
    setUploadTab('device');
    setUploadOpen(true);
  };

  /** Validate + stage files coming from the file picker or a drag & drop. */
  const addPickedFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const accepted: PickedFile[] = [];
    const rejected: string[] = [];
    Array.from(list).forEach((f) => {
      if (!f.type.startsWith('image/')) { rejected.push(`${f.name} — not an image`); return; }
      if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { rejected.push(`${f.name} — larger than ${MAX_UPLOAD_MB} MB`); return; }
      accepted.push({ file: f, preview: URL.createObjectURL(f) });
    });
    if (rejected.length) {
      addToast({ type: 'error', title: 'Some files were skipped', description: rejected.join(' · ') });
    }
    if (accepted.length) setPickedFiles((prev) => [...prev, ...accepted]);
  };

  const removePickedFile = (idx: number) => {
    setPickedFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Free object-URL previews whenever the dialog closes.
  useEffect(() => {
    if (!uploadOpen) {
      setPickedFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview));
        return [];
      });
      setIsDragOver(false);
      setUploadProgress(null);
    }
  }, [uploadOpen]);

  /** Upload one staged file: store it via /admin/media/upload, then register
   *  it in the library with the shared category/alt text. `origin` records
   *  which dashboard page/section the file was uploaded from, so the library
   *  can show provenance for images added through page templates. */
  const uploadOneFile = async (
    file: File,
    category: string,
    altText: string,
    origin?: { sourcePage?: string; sourceSection?: string },
  ) => {
    const res = await apiClient.upload<{ url: string; name?: string; size: number }>('/admin/media/upload', file);
    const kb = res.size / 1024;
    const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
    await apiClient.post('/admin/media', {
      name: file.name,
      url: res.url,
      category,
      altText: altText.trim() || undefined,
      size: sizeLabel,
      ...(origin ? origin : {}),
    });
  };

  const handleDeviceUpload = async () => {
    if (pickedFiles.length === 0) {
      addToast({ type: 'error', title: 'No image selected', description: 'Browse or drag & drop at least one image first.' });
      return;
    }
    setIsSaving(true);
    setUploadProgress({ done: 0, total: pickedFiles.length });
    const failed: PickedFile[] = [];
    let okCount = 0;
    for (let i = 0; i < pickedFiles.length; i++) {
      const picked = pickedFiles[i];
      try {
        await uploadOneFile(picked.file, uploadForm.category, uploadForm.altText);
        okCount++;
        URL.revokeObjectURL(picked.preview);
      } catch {
        failed.push(picked);
      }
      setUploadProgress({ done: i + 1, total: pickedFiles.length });
    }
    setIsSaving(false);
    setUploadProgress(null);
    if (okCount > 0) {
      addToast({
        type: 'success',
        title: `${okCount} image${okCount === 1 ? '' : 's'} uploaded`,
        description: failed.length
          ? `${failed.length} file${failed.length === 1 ? '' : 's'} could not be uploaded.`
          : 'Published to the media library.',
      });
      await load();
    }
    if (failed.length > 0) {
      setPickedFiles(failed); // keep only the failures so they can be retried
      addToast({ type: 'error', title: 'Upload failed', description: failed.map((f) => f.file.name).join(' · ') });
    } else {
      setPickedFiles([]);
      setUploadForm((f) => ({ ...f, altText: '' }));
      setUploadOpen(false);
    }
  };

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

  const tabBtn = (active: boolean) =>
    'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
    (active ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-800');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description="Add, categorize, edit, replace and publish images — then drop any image onto a product in one step."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Media' }]}
        actions={
          canUpload ? (
            <Button onClick={openUpload}>
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
          description="Upload images from your device or add by URL to start building your library — then use them anywhere."
          action={canUpload ? { label: 'Add Image', onClick: openUpload } : undefined}
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
                {item.sourcePage && (
                  <p className="mt-1 flex items-center gap-1 text-2xs text-brand-600" title={`Uploaded from the ${item.sourcePage} template editor`}>
                    <FileText className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">From: {item.sourcePage}{item.sourceSection ? ` · ${item.sourceSection}` : ''}</span>
                  </p>
                )}
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
{/* Add image dialog — upload from device (browse / drag & drop) or add by URL */}
      {uploadOpen && (
        <Dialog
          open
          maxWidth="md"
          onClose={() => { if (!isSaving) setUploadOpen(false); }}
          title="Add image"
          description="Upload images straight from your computer — drag & drop or browse — or paste an image URL. Everything is published immediately and categorized for easy reuse."
          primaryAction={
            uploadTab === 'device'
              ? {
                  label: uploadProgress
                    ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                    : pickedFiles.length > 1
                      ? `Upload ${pickedFiles.length} images`
                      : 'Upload Image',
                  onClick: handleDeviceUpload,
                  isLoading: isSaving,
                }
              : { label: 'Add Image', onClick: handleUpload, isLoading: isSaving }
          }
        >
          <div className="space-y-4">
            {/* Upload source tabs */}
            <div className="flex gap-1 rounded-lg bg-surface-100 p-1" role="tablist" aria-label="Upload source">
              {([['device', 'From device'], ['url', 'From URL']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={uploadTab === tab}
                  disabled={isSaving}
                  onClick={() => setUploadTab(tab)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    uploadTab === tab
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-500 hover:text-surface-700',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {uploadTab === 'device' ? (
              <>
                {/* Drop zone — click to browse, or drag & drop images from your computer */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload images: drag and drop here or browse your files"
                  onClick={() => { if (!isSaving) fileInputRef.current?.click(); }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isSaving) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setIsDragOver(true); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    dragDepth.current = Math.max(0, dragDepth.current - 1);
                    if (dragDepth.current === 0) setIsDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dragDepth.current = 0;
                    setIsDragOver(false);
                    if (!isSaving) addPickedFiles(e.dataTransfer.files);
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                    isDragOver
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-surface-300 bg-surface-50 hover:border-brand-400 hover:bg-brand-50/40',
                    isSaving && 'pointer-events-none opacity-60',
                  )}
                >
                  <Upload className={cn('h-7 w-7', isDragOver ? 'text-brand-600' : 'text-surface-400')} />
                  <p className="text-sm font-medium text-surface-700">
                    {isDragOver ? (
                      'Drop to upload'
                    ) : (
                      <>
                        Drag &amp; drop images here, or{' '}
                        <span className="text-brand-600 underline underline-offset-2">browse your files</span>
                      </>
                    )}
                  </p>
                  <p className="text-2xs text-surface-400">
                    PNG, JPG, WEBP or GIF · up to {MAX_UPLOAD_MB} MB each · multiple files welcome
                  </p>
                </div>
                {/* Hidden native file picker ("browse your local store") */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addPickedFiles(e.target.files); e.target.value = ''; }}
                />
                {/* Staged previews */}
                {pickedFiles.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-surface-500">
                      {pickedFiles.length} image{pickedFiles.length === 1 ? '' : 's'} ready
                      {uploadProgress ? ` · uploading ${uploadProgress.done}/${uploadProgress.total}…` : ''}
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {pickedFiles.map((p, i) => (
                        <div key={p.preview} className="group relative aspect-square overflow-hidden rounded-lg border border-surface-200 bg-surface-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.preview} alt={p.file.name} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            title="Remove"
                            disabled={isSaving}
                            onClick={() => removePickedFile(i)}
                            className="absolute right-1 top-1 rounded-full bg-surface-900/70 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <p className="absolute inset-x-0 bottom-0 truncate bg-surface-900/60 px-1 py-0.5 text-2xs text-white">
                            {p.file.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Select
                    label="Category"
                    value={uploadForm.category}
                    onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    options={CATEGORY_PRESETS.map((c) => ({ value: c, label: c }))}
                  />
                  <Input
                    label="Alt text (applied to all)"
                    value={uploadForm.altText}
                    onChange={(e) => setUploadForm({ ...uploadForm, altText: e.target.value })}
                    placeholder="Accessible description"
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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