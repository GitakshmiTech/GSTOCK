import React, { useEffect, useState } from 'react';
import { AuthUser, ScreenDefinition } from '../types';
import { fetchUsers, fetchScreens, createUser, updateUser, deleteUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const UserManagement: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [screens, setScreens] = useState<ScreenDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // Form State for Create
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newScreens, setNewScreens] = useState<string[]>(['seasonality']);
  const [newIsActive, setNewIsActive] = useState(true);

  // Form State for Edit
  const [editEmail, setEditEmail] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [editScreens, setEditScreens] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [uList, sList] = await Promise.all([fetchUsers(), fetchScreens()]);
      setUsers(uList);
      setScreens(sList);
    } catch (err: any) {
      setError(err.message || 'Failed to load user management data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setNewEmail('');
    setNewUsername('');
    setNewFullName('');
    setNewPassword('');
    setNewRole('user');
    setNewScreens(['seasonality']); // default to seasonal per user workflow preference
    setNewIsActive(true);
    setShowCreateModal(true);
  };

  const openEditModal = (u: AuthUser) => {
    setEditingUser(u);
    setEditEmail(u.email || '');
    setEditFullName(u.full_name || '');
    setEditPassword('');
    setEditRole(u.role);
    setEditScreens(u.accessible_screens || []);
    setEditIsActive(u.is_active);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() && !newUsername.trim()) {
      setError('Email ID is required');
      return;
    }
    if (!newPassword.trim()) {
      setError('Password is required');
      return;
    }

    try {
      setError(null);
      const emailVal = newEmail.trim();
      const unameVal = newUsername.trim() || emailVal.split('@')[0];

      await createUser({
        email: emailVal,
        username: unameVal,
        full_name: newFullName.trim() || undefined,
        password: newPassword.trim(),
        role: newRole,
        accessible_screens: newRole === 'admin' ? screens.map((s) => s.key) : newScreens,
        is_active: newIsActive,
      });
      setShowCreateModal(false);
      setSuccessMsg(`User "${emailVal}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setError(null);
      await updateUser(editingUser.id, {
        email: editEmail.trim() || undefined,
        full_name: editFullName.trim() || undefined,
        password: editPassword.trim() ? editPassword.trim() : undefined,
        role: editRole,
        accessible_screens: editRole === 'admin' ? screens.map((s) => s.key) : editScreens,
        is_active: editIsActive,
      });
      setEditingUser(null);
      setSuccessMsg(`User "${editingUser.username}" updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
      if (currentUser?.id === editingUser.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleDelete = async (u: AuthUser) => {
    if (!window.confirm(`Are you sure you want to delete user "${u.email || u.username}"?`)) {
      return;
    }

    try {
      setError(null);
      await deleteUser(u.id);
      setSuccessMsg(`User "${u.email || u.username}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const toggleScreen = (list: string[], setList: (s: string[]) => void, screenKey: string) => {
    if (list.includes(screenKey)) {
      setList(list.filter((k) => k !== screenKey));
    } else {
      setList([...list, screenKey]);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="var(--accent)" />
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              User & Role Management
            </h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Manage platform accounts via Email ID and assign granular screen access (e.g. Seasonal Analysis only).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Reload</span>
          </button>
          <button
            className="btn-primary"
            onClick={openCreateModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--tile-neg-bg)',
          border: '1px solid var(--tile-neg-border)',
          color: 'var(--tile-neg-color)',
          fontSize: '13px',
          marginBottom: '20px',
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--tile-pos-bg)',
          border: '1px solid var(--tile-pos-border)',
          color: 'var(--tile-pos-color)',
          fontSize: '13px',
          marginBottom: '20px',
        }}>
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            Registered Users ({users.length})
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
            EMAIL-BASED AUTH & RBAC
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--table-th-bg)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>ID</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Email ID (Login)</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Username</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Full Name</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Accessible Screens</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === 'admin';
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>
                      #{u.id}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'JetBrains Mono' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MailIcon />
                        <span>{u.email || `${u.username}@nse.com`}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                      {u.username}
                      {currentUser?.id === u.id && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--nav-active-bg)',
                          color: 'var(--accent)',
                        }}>
                          YOU
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-main)' }}>
                      {u.full_name || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono',
                        backgroundColor: isAdmin ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                        color: isAdmin ? 'var(--accent)' : 'var(--green)',
                        border: `1px solid ${isAdmin ? 'rgba(37, 99, 235, 0.3)' : 'rgba(22, 163, 74, 0.3)'}`,
                      }}>
                        {isAdmin ? <Shield size={12} /> : <Key size={12} />}
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {isAdmin ? (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--nav-active-bg)',
                          color: 'var(--accent)',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>
                          Full Access (All {screens.length} Screens)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {u.accessible_screens && u.accessible_screens.length > 0 ? (
                            u.accessible_screens.map((sk) => {
                              const match = screens.find((s) => s.key === sk);
                              const label = match ? match.label : sk;
                              const isSeasonal = sk === 'seasonality';
                              return (
                                <span
                                  key={sk}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: isSeasonal ? 'var(--tile-pos-bg)' : 'var(--bg-hover)',
                                    color: isSeasonal ? 'var(--tile-pos-color)' : 'var(--text-main)',
                                    border: `1px solid ${isSeasonal ? 'var(--tile-pos-border)' : 'var(--border)'}`,
                                    fontSize: '11px',
                                    fontWeight: 500,
                                  }}
                                >
                                  {label}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontStyle: 'italic' }}>
                              No screens assigned
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        color: u.is_active ? 'var(--green)' : 'var(--red)',
                        fontWeight: 600,
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: u.is_active ? 'var(--green)' : 'var(--red)',
                        }} />
                        {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => openEditModal(u)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={currentUser?.id === u.id}
                          style={{
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--red)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            cursor: currentUser?.id === u.id ? 'not-allowed' : 'pointer',
                            opacity: currentUser?.id === u.id ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={currentUser?.id === u.id ? 'Cannot delete current logged-in user' : 'Delete user'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--accent)" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Create New User
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Email ID (Login Credential) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. seasonal_user@nse.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Username (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-derived if blank"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                  }}
                >
                  <option value="user">User (Restricted Screen Access)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {/* Screen permissions assignment */}
              {newRole === 'user' ? (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Assign Screen Access Permissions:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setNewScreens(['seasonality'])}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Seasonal Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewScreens(screens.filter((s) => s.key !== 'users').map((s) => s.key))}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        All Trading Screens
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}>
                    {screens.filter((s) => s.key !== 'users').map((s) => {
                      const isChecked = newScreens.includes(s.key);
                      return (
                        <label
                          key={s.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? 'var(--bg-hover)' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleScreen(newScreens, setNewScreens, s.key)}
                            style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {s.label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {s.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--nav-active-bg)',
                  border: '1px solid var(--accent)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  marginBottom: '20px',
                }}>
                  🛡️ Administrator accounts automatically have full access to all platform screens, data management, and user controls.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save & Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={20} color="var(--accent)" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Edit User: {editingUser.email || editingUser.username}
                </h2>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Email ID (Login Credential)
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Reset Password (optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Account Status
                  </label>
                  <select
                    value={editIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditIsActive(e.target.value === 'active')}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                  }}
                >
                  <option value="user">User (Restricted Screen Access)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              {/* Screens */}
              {editRole === 'user' ? (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Assigned Screen Access:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setEditScreens(['seasonality'])}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Seasonal Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditScreens(screens.filter((s) => s.key !== 'users').map((s) => s.key))}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        All Trading Screens
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}>
                    {screens.filter((s) => s.key !== 'users').map((s) => {
                      const isChecked = editScreens.includes(s.key);
                      return (
                        <label
                          key={s.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            backgroundColor: isChecked ? 'var(--bg-hover)' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleScreen(editScreens, setEditScreens, s.key)}
                            style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {s.label}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {s.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--nav-active-bg)',
                  border: '1px solid var(--accent)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  marginBottom: '20px',
                }}>
                  🛡️ Administrator accounts have complete access to all platform screens.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
