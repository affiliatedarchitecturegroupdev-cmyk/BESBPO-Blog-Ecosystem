'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: 'pending' | 'active' | 'suspended' | 'offboarded';
  deliveryMode: 'client_side' | 'build_time' | 'both';
  divisions: string[];
  githubRepo?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [filter, setFilter] = useState({
    status: '',
    search: '',
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/tenants`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }

      const data = await response.json();
      setTenants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenants');
      // Use mock data for demo
      setTenants(getMockTenants());
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tenantId: string, newStatus: Tenant['status']) => {
    const originalTenants = [...tenants];
    
    // Optimistic update
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/tenants/${tenantId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update tenant');
      }
    } catch (err) {
      setTenants(originalTenants);
      setError(err instanceof Error ? err.message : 'Failed to update tenant');
    }
  };

  const handleDelete = async (tenantId: string) => {
    if (!confirm('Are you sure you want to delete this tenant?')) {
      return;
    }

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL || 'http://localhost:3000'}/tenants/${tenantId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant');
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    if (filter.status && tenant.status !== filter.status) {
      return false;
    }
    if (
      filter.search &&
      !tenant.name.toLowerCase().includes(filter.search.toLowerCase()) &&
      !tenant.domain.toLowerCase().includes(filter.search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getStatusColor = (status: Tenant['status']) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'suspended':
        return '#6b7280';
      case 'offboarded':
        return '#dc2626';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading tenants...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tenant Management</h1>
          <p className={styles.subtitle}>
            Manage subsidiary sites and syndication partners
          </p>
        </div>
        <button className={styles.addButton} onClick={() => setShowModal(true)}>
          Add Tenant
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search tenants..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
        />
        <select
          className={styles.filterSelect}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="offboarded">Offboarded</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Delivery Mode</th>
              <th>Divisions</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyRow}>
                  No tenants found
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <div className={styles.tenantName}>{tenant.name}</div>
                    {tenant.githubRepo && (
                      <div className={styles.githubRepo}>{tenant.githubRepo}</div>
                    )}
                  </td>
                  <td>
                    <a
                      href={`https://${tenant.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.domainLink}
                    >
                      {tenant.domain}
                    </a>
                  </td>
                  <td>
                    <span
                      className={styles.statusBadge}
                      style={{ backgroundColor: getStatusColor(tenant.status) }}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td>{tenant.deliveryMode.replace('_', ' ')}</td>
                  <td>
                    <div className={styles.divisionTags}>
                      {tenant.divisions.map((d) => (
                        <span key={d} className={styles.divisionTag}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{new Date(tenant.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.actionButton}
                        onClick={() => {
                          setEditingTenant(tenant);
                          setShowModal(true);
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <select
                        className={styles.statusSelect}
                        value={tenant.status}
                        onChange={(e) =>
                          handleStatusChange(tenant.id, e.target.value as Tenant['status'])
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="offboarded">Offboarded</option>
                      </select>
                      <button
                        className={`${styles.actionButton} ${styles.danger}`}
                        onClick={() => handleDelete(tenant.id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{tenants.length}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {tenants.filter((t) => t.status === 'active').length}
          </span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {tenants.filter((t) => t.status === 'pending').length}
          </span>
          <span className={styles.statLabel}>Pending</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {tenants.filter((t) => t.status === 'suspended').length}
          </span>
          <span className={styles.statLabel}>Suspended</span>
        </div>
      </div>

      {/* Modal Placeholder */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingTenant ? 'Edit Tenant' : 'Add Tenant'}</h2>
              <button className={styles.closeButton} onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>Tenant form would go here.</p>
              <p>Fields: name, domain, delivery mode, divisions, API key</p>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowModal(false);
                  setEditingTenant(null);
                }}
              >
                Cancel
              </button>
              <button className={styles.saveButton}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMockTenants(): Tenant[] {
  return [
    {
      id: '1',
      name: 'Gauteng Infrastructure News',
      domain: 'gauteng.besbpo.co.za',
      status: 'active',
      deliveryMode: 'client_side',
      divisions: ['built-environment', 'infrastructure', 'transportation'],
      githubRepo: 'besbpo/gauteng-news',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-06-01T10:00:00Z',
    },
    {
      id: '2',
      name: 'Western Cape Development',
      domain: 'capetown.besbpo.co.za',
      status: 'active',
      deliveryMode: 'build_time',
      divisions: ['smart-cities', 'sustainability'],
      githubRepo: 'besbpo/western-cape',
      createdAt: '2024-02-20T10:00:00Z',
      updatedAt: '2024-05-15T10:00:00Z',
    },
    {
      id: '3',
      name: 'KwaZulu-Natal Projects',
      domain: 'kzn.besbpo.co.za',
      status: 'pending',
      deliveryMode: 'both',
      divisions: ['housing', 'water-waste'],
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T10:00:00Z',
    },
    {
      id: '4',
      name: 'Eastern Cape Infrastructure',
      domain: 'ec.besbpo.co.za',
      status: 'suspended',
      deliveryMode: 'client_side',
      divisions: ['infrastructure', 'energy'],
      createdAt: '2024-03-10T10:00:00Z',
      updatedAt: '2024-04-01T10:00:00Z',
    },
  ];
}
