'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

interface MediaAsset {
  id: string;
  s3Key: string;
  variants: {
    thumbnail?: string;
    webp_1200?: string;
    webp_800?: string;
    original?: string;
  };
  altText?: string;
  uploadedBy: string;
  createdAt: string;
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState({
    search: '',
    type: '',
  });
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/media`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch media assets');
      }

      const data = await response.json();
      setAssets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load media');
      // Use mock data for demo
      setAssets(getMockAssets());
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedAssets: MediaAsset[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('altText', file.name.replace(/\.[^/.]+$/, ''));

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/media/upload`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
            body: formData,
          }
        );

        if (response.ok) {
          const asset = await response.json();
          uploadedAssets.push(asset);
        }
      } catch (err) {
        console.error('Upload failed:', file.name, err);
      }
    }

    setAssets((prev) => [...uploadedAssets, ...prev]);
    setUploading(false);
    setUploadModalOpen(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return;
    }

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/media/${assetId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedAssets.size} selected assets?`
      )
    ) {
      return;
    }

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/media/bulk`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ ids: Array.from(selectedAssets) }),
        }
      );

      setAssets((prev) => prev.filter((a) => !selectedAssets.has(a.id)));
      setSelectedAssets(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete assets');
    }
  };

  const toggleSelectAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const selectAll = () => {
    if (filteredAssets.every((a) => selectedAssets.has(a.id))) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map((a) => a.id)));
    }
  };

  const filteredAssets = assets.filter((asset) => {
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      if (
        !asset.altText?.toLowerCase().includes(searchLower) &&
        !asset.s3Key.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (filter.type) {
      const extension = asset.s3Key.split('.').pop()?.toLowerCase();
      if (filter.type === 'image' && !['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) {
        return false;
      }
      if (filter.type === 'video' && !['mp4', 'webm', 'mov'].includes(extension || '')) {
        return false;
      }
    }
    return true;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileType = (s3Key: string) => {
    const ext = s3Key.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov'].includes(ext || '')) {
      return 'video';
    }
    return 'file';
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading media library...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Media Library</h1>
          <p className={styles.subtitle}>
            Manage images, videos, and documents
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.uploadButton} onClick={() => setUploadModalOpen(true)}>
            Upload
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search media..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className={styles.filterSelect}
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
          >
            ▦
          </button>
          <button
            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAssets.size > 0 && (
        <div className={styles.bulkActions}>
          <span>{selectedAssets.size} selected</span>
          <button className={styles.deleteButton} onClick={handleBulkDelete}>
            Delete Selected
          </button>
          <button className={styles.clearButton} onClick={() => setSelectedAssets(new Set())}>
            Clear Selection
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Media Grid/List */}
      {filteredAssets.length === 0 ? (
        <div className={styles.empty}>
          <p>No media assets found</p>
          <button onClick={() => setUploadModalOpen(true)}>Upload your first asset</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={styles.grid}>
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className={`${styles.gridItem} ${
                selectedAssets.has(asset.id) ? styles.selected : ''
              }`}
            >
              <div className={styles.gridItemHeader}>
                <input
                  type="checkbox"
                  checked={selectedAssets.has(asset.id)}
                  onChange={() => toggleSelectAsset(asset.id)}
                />
                <span className={styles.fileType}>{getFileType(asset.s3Key)}</span>
              </div>
              <div className={styles.gridItemPreview}>
                {getFileType(asset.s3Key) === 'image' ? (
                  <img
                    src={asset.variants.thumbnail || asset.variants.original || '/placeholder.png'}
                    alt={asset.altText || 'Media asset'}
                    className={styles.previewImage}
                  />
                ) : (
                  <div className={styles.fileIcon}>
                    {getFileType(asset.s3Key) === 'video' ? '🎬' : '📄'}
                  </div>
                )}
              </div>
              <div className={styles.gridItemInfo}>
                <p className={styles.fileName}>{asset.altText || asset.s3Key}</p>
                <p className={styles.fileMeta}>
                  {new Date(asset.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className={styles.gridItemActions}>
                <button
                  className={styles.iconButton}
                  onClick={() => copyToClipboard(asset.s3Key)}
                  title="Copy URL"
                >
                  📋
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => handleDelete(asset.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <input
              type="checkbox"
              checked={filteredAssets.every((a) => selectedAssets.has(a.id))}
              onChange={selectAll}
            />
            <span>Name</span>
            <span>Type</span>
            <span>Uploaded</span>
            <span>Actions</span>
          </div>
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className={`${styles.listItem} ${
                selectedAssets.has(asset.id) ? styles.selected : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAssets.has(asset.id)}
                onChange={() => toggleSelectAsset(asset.id)}
              />
              <div className={styles.listItemName}>
                {getFileType(asset.s3Key) === 'image' && (
                  <img
                    src={asset.variants.thumbnail || asset.variants.original || '/placeholder.png'}
                    alt=""
                    className={styles.listThumb}
                  />
                )}
                <span>{asset.altText || asset.s3Key}</span>
              </div>
              <span>{getFileType(asset.s3Key)}</span>
              <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
              <div className={styles.listActions}>
                <button onClick={() => copyToClipboard(asset.s3Key)}>📋</button>
                <button onClick={() => handleDelete(asset.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setUploadModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Upload Media</h2>
              <button className={styles.closeButton} onClick={() => setUploadModalOpen(false)}>
                ×
              </button>
            </div>
            <div
              className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className={styles.uploading}>
                  <div className={styles.spinner} />
                  <p>Uploading...</p>
                </div>
              ) : (
                <>
                  <p>Drag and drop files here, or click to select</p>
                  <p className={styles.dropzoneHint}>
                    Supports: JPG, PNG, GIF, WebP, SVG, MP4, WebM, MOV
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{assets.length}</span>
          <span className={styles.statLabel}>Total Assets</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {assets.filter((a) => getFileType(a.s3Key) === 'image').length}
          </span>
          <span className={styles.statLabel}>Images</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {assets.filter((a) => getFileType(a.s3Key) === 'video').length}
          </span>
          <span className={styles.statLabel}>Videos</span>
        </div>
      </div>
    </div>
  );
}

function getMockAssets(): MediaAsset[] {
  return [
    {
      id: '1',
      s3Key: 'articles/smart-cities-hero.jpg',
      variants: {
        thumbnail: 'https://picsum.photos/200/150?random=1',
        original: 'https://picsum.photos/1200/800?random=1',
      },
      altText: 'Smart Cities Hero Image',
      uploadedBy: 'John Smith',
      createdAt: '2024-06-01T10:00:00Z',
    },
    {
      id: '2',
      s3Key: 'articles/sustainability-infographic.png',
      variants: {
        thumbnail: 'https://picsum.photos/200/150?random=2',
        original: 'https://picsum.photos/1200/800?random=2',
      },
      altText: 'Sustainability Infographic',
      uploadedBy: 'Jane Doe',
      createdAt: '2024-05-28T10:00:00Z',
    },
    {
      id: '3',
      s3Key: 'articles/infrastructure-map.svg',
      variants: {
        thumbnail: 'https://picsum.photos/200/150?random=3',
        original: 'https://picsum.photos/1200/800?random=3',
      },
      altText: 'Infrastructure Map',
      uploadedBy: 'Bob Johnson',
      createdAt: '2024-05-20T10:00:00Z',
    },
    {
      id: '4',
      s3Key: 'articles/energy-project-video.mp4',
      variants: {},
      altText: 'Energy Project Video',
      uploadedBy: 'Alice Brown',
      createdAt: '2024-05-15T10:00:00Z',
    },
    {
      id: '5',
      s3Key: 'articles/transportation-overview.jpg',
      variants: {
        thumbnail: 'https://picsum.photos/200/150?random=5',
        original: 'https://picsum.photos/1200/800?random=5',
      },
      altText: 'Transportation Overview',
      uploadedBy: 'John Smith',
      createdAt: '2024-05-10T10:00:00Z',
    },
  ];
}
