'use client';

import React, { useState } from 'react';
import { useAuth } from '@/config/auth-context';
import { formatDateTime } from '@/lib/utils';
import { canAct } from '@/config/rbac';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { Image, Upload, Trash2, Download, FileImage, FileVideo, File } from 'lucide-react';

interface MediaItem {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  thumbnailUrl: string;
  size: string;
  dimensions?: string;
  uploadedBy: string;
  usedIn: string[];
  createdAt: string;
}

const MOCK_MEDIA: MediaItem[] = [
  { id: 'MED-001', name: 'hero-banner-2026.jpg', type: 'IMAGE', url: '#', thumbnailUrl: '#', size: '2.4 MB', dimensions: '1920x1080', uploadedBy: 'Hari Editor', usedIn: ['Homepage'], createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'MED-002', name: 'basmati-rice-product.jpg', type: 'IMAGE', url: '#', thumbnailUrl: '#', size: '1.8 MB', dimensions: '800x800', uploadedBy: 'Hari Editor', usedIn: ['Products'], createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'MED-003', name: 'farm-process-video.mp4', type: 'VIDEO', url: '#', thumbnailUrl: '#', size: '45.2 MB', uploadedBy: 'Hari Editor', usedIn: ['About Us'], createdAt: new Date(Date.now() - 259200000).toISOString() },
  { id: 'MED-004', name: 'turmeric-powder.jpg', type: 'IMAGE', url: '#', thumbnailUrl: '#', size: '1.2 MB', dimensions: '800x800', uploadedBy: 'Hari Editor', usedIn: ['Products'], createdAt: new Date(Date.now() - 345600000).toISOString() },
  { id: 'MED-005', name: 'wholesale-catalog.pdf', type: 'DOCUMENT', url: '#', thumbnailUrl: '#', size: '3.5 MB', uploadedBy: 'Super Admin', usedIn: ['Wholesale Page'], createdAt: new Date(Date.now() - 432000000).toISOString() },
  { id: 'MED-006', name: 'team-photo.jpg', type: 'IMAGE', url: '#', thumbnailUrl: '#', size: '2.1 MB', dimensions: '1200x800', uploadedBy: 'Hari Editor', usedIn: ['About Us'], createdAt: new Date(Date.now() - 518400000).toISOString() },
];

const TYPE_ICONS: Record<string, typeof Image> = {
  IMAGE: FileImage,
  VIDEO: FileVideo,
  DOCUMENT: File,
};

/** Screen: Media Library
 *  Can view: SUPER_ADMIN, ADMIN, CONTENT_MANAGER
 *  Can upload: CONTENT_MANAGER
 *  Can delete: SUPER_ADMIN, ADMIN
 */
export default function MediaPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [typeFilter, setTypeFilter] = useState('');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<MediaItem | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>(MOCK_MEDIA);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const canUpload = user && canAct(user.role, 'media:upload');
  const canDelete = user && canAct(user.role, 'media:delete');

  const filteredMedia = mediaList.filter((m) => {
    if (typeFilter && m.type !== typeFilter) return false;
    return true;
  });

  const handleUpload = () => {
    if (pendingFiles.length === 0) {
      addToast({ type: 'error', title: 'No files selected', description: 'Choose at least one file to upload.' });
      return;
    }
    const now = new Date().toISOString();
    const added: MediaItem[] = pendingFiles.map((f, i) => ({
      id: 'MED-' + String(Date.now()).slice(-5) + i,
      name: f.name,
      type: f.type.startsWith('image/') ? 'IMAGE' : f.type.startsWith('video/') ? 'VIDEO' : 'DOCUMENT',
      url: '#',
      thumbnailUrl: '#',
      size: (f.size / (1024 * 1024)).toFixed(1) + ' MB',
      uploadedBy: user?.name ?? user?.email ?? 'You',
      usedIn: [],
      createdAt: now,
    }));
    setMediaList((prev) => [...added, ...prev]);
    addToast({
      type: 'success',
      title: `${added.length} file${added.length > 1 ? 's' : ''} uploaded`,
      description: 'Your files have been added to the media library.',
    });
    setPendingFiles([]);
    setUploadDialog(false);
  };

  const handleDownload = (media: MediaItem) => {
    // Media URLs are placeholders in this demo build — generate a stub file
    // client-side so the button always produces a real download.
    const blob = new Blob([`Aamako Agro media library export\n\nFile: ${media.name}\nType: ${media.type}\nSize: ${media.size}\nUploaded by: ${media.uploadedBy}\n`], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = media.name + '.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    addToast({ type: 'success', title: 'Download started', description: media.name });
  };

  const handleDelete = () => {
    if (!deleteDialog) return;
    setMediaList((prev) => prev.filter((m) => m.id !== deleteDialog.id));
    addToast({
      type: 'success',
      title: 'File deleted',
      description: `${deleteDialog.name} has been removed.`,
    });
    setDeleteDialog(null);
  };

  const typeTabs = [
    { value: '', label: 'All Files' },
    { value: 'IMAGE', label: 'Images' },
    { value: 'VIDEO', label: 'Videos' },
    { value: 'DOCUMENT', label: 'Documents' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description="Manage images, videos, and documents"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Media' }]}
        actions={
          canUpload ? (
            <Button onClick={() => setUploadDialog(true)}>
              <Upload className="h-4 w-4" /> Upload Files
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Total Files</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">{mediaList.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Images</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">
            {mediaList.filter((m) => m.type === 'IMAGE').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Videos</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">
            {mediaList.filter((m) => m.type === 'VIDEO').length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-surface-500 uppercase">Documents</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900">
            {mediaList.filter((m) => m.type === 'DOCUMENT').length}
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select
          options={typeTabs}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
        <EmptyState
          icon={Image}
          title="No media files"
          description="Upload images, videos, and documents to use across your content."
          action={canUpload ? { label: 'Upload Files', onClick: () => setUploadDialog(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((media) => {
            const Icon = TYPE_ICONS[media.type] || File;
            return (
              <Card key={media.id} className="group relative overflow-hidden">
                {/* Thumbnail placeholder */}
                <div className="aspect-square bg-surface-100 flex items-center justify-center">
                  <Icon className="h-12 w-12 text-surface-300" />
                </div>

                {/* Info overlay */}
                <div className="p-3">
                  <p className="text-sm font-medium text-surface-900 truncate">{media.name}</p>
                  <p className="text-2xs text-surface-500">{media.size}</p>
                  {media.dimensions && (
                    <p className="text-2xs text-surface-400">{media.dimensions}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    {media.usedIn.map((use) => (
                      <Badge key={use} variant="neutral" className="text-2xs">{use}</Badge>
                    ))}
                  </div>
                </div>

                {/* Actions on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bg-white/90 shadow-sm"
                    title="Download"
                    onClick={() => handleDownload(media)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="sm" className="bg-white/90 shadow-sm" onClick={() => setDeleteDialog(media)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      {uploadDialog && (
        <Dialog
          open={uploadDialog}
          onClose={() => setUploadDialog(false)}
          title="Upload Files"
          description="Upload images, videos, and documents to the media library"
          primaryAction={{
            label: 'Upload',
            onClick: handleUpload,
          }}
        >
          <label className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center hover:border-brand-400 transition-colors cursor-pointer block">
            <Upload className="h-10 w-10 text-surface-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-700">
              {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''} selected` : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-surface-500 mt-1">PNG, JPG, GIF, MP4, PDF up to 50MB</p>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
            />
          </label>
        </Dialog>
      )}

      {/* Delete Dialog */}
      {deleteDialog && (
        <Dialog
          open={!!deleteDialog}
          onClose={() => setDeleteDialog(null)}
          title="Delete file?"
          description="This will permanently remove the file from the media library."
          primaryAction={{
            label: 'Delete',
            onClick: handleDelete,
          }}
        >
          <div className="rounded-lg bg-surface-50 p-3 text-sm">
            <p><span className="font-medium">File:</span> {deleteDialog.name}</p>
            <p><span className="font-medium">Size:</span> {deleteDialog.size}</p>
            {deleteDialog.usedIn.length > 0 && (
              <p className="text-amber-600 mt-2">⚠️ This file is used in: {deleteDialog.usedIn.join(', ')}</p>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
