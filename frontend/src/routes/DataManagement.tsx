import React, { useEffect, useState } from 'react';
import {
  IngestionJob,
  BhavcopyImportResult,
  LatestAvailableDateInfo,
  IngestedFileItem,
} from '../types';
import {
  fetchIngestionJobs,
  fetchSchedulerStatus,
  triggerDailyUpdate,
  downloadAndImportBhavcopy,
  fetchLatestAvailableDate,
  fetchIngestedFiles,
  SchedulerStatus,
} from '../services/api';
import { LoadingState } from '../components/common/LoadingState';
import {
  Download,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Database,
} from 'lucide-react';


export const DataManagement: React.FC = () => {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [files, setFiles] = useState<IngestedFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'files' | 'jobs'>('files');
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  // Bhavcopy Ingestion Form State
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [forceRedownload, setForceRedownload] = useState<boolean>(false);
  const [latestDateInfo, setLatestDateInfo] = useState<LatestAvailableDateInfo | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<BhavcopyImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchIngestionJobs(),
      fetchIngestedFiles(50),
      fetchSchedulerStatus(),
      fetchLatestAvailableDate(),
    ])
      .then(([jobsData, filesData, schedData, dateInfo]) => {
        setJobs(jobsData);
        setFiles(filesData);
        setSchedulerStatus(schedData);
        setLatestDateInfo(dateInfo);
        if (!selectedDate && dateInfo?.latest_trade_date) {
          setSelectedDate(dateInfo.latest_trade_date);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading data management info:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePickLatestDate = () => {
    if (latestDateInfo?.latest_trade_date) {
      setSelectedDate(latestDateInfo.latest_trade_date);
    }
  };

  const handleDownloadAndImport = async () => {
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const res = await downloadAndImportBhavcopy(selectedDate || undefined, forceRedownload);
      setImportResult(res);
      if (res.status === 'failed') {
        setImportError(res.error_details || res.message);
      }
      // Refresh audit logs
      fetchIngestionJobs().then(setJobs).catch(console.error);
      fetchIngestedFiles(50).then(setFiles).catch(console.error);
    } catch (err: any) {
      setImportError(err.message || 'Download & import operation failed');
    } finally {
      setImporting(false);
    }
  };

  const handleTriggerDaily = async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await triggerDailyUpdate();
      setTriggerMsg(res.message || 'Daily EOD update triggered.');
      setTimeout(() => loadData(), 2000);
    } catch (err: any) {
      setTriggerMsg(`Trigger failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={22} color="var(--accent)" />
            Automatic NSE Bhavcopy Pipeline & Database Ingestion
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Direct official NSE CM-UDiFF / Legacy archive download, in-memory stream parsing, quality validation, and idempotent bulk upsert.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-primary" onClick={handleTriggerDaily} disabled={triggering}>
            {triggering ? 'Triggering...' : '⚡ Trigger 4:00 PM Update Now'}
          </button>
          <button className="btn-secondary" onClick={loadData}>
            <RefreshCw size={14} style={{ marginRight: '6px' }} />
            Refresh
          </button>
        </div>
      </div>

      {triggerMsg && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '10px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
        }}>
          ℹ️ {triggerMsg}
        </div>
      )}

      {/* Main Bhavcopy Download & Import Card */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              backgroundColor: 'rgba(230, 126, 34, 0.15)',
              color: '#f39c12',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
            }}>
              OFFICIAL NSE INDIA PIPELINE
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Source: <a href="https://www.nseindia.com/all-reports" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>nseindia.com/all-reports</a>
            </span>
          </div>
          {latestDateInfo && (
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
              Latest Available Market Date: <b style={{ color: 'var(--accent)' }}>{latestDateInfo.latest_trade_date}</b>
              {latestDateInfo.latest_db_date && (
                <span> (DB Latest: <b style={{ color: '#10b981' }}>{latestDateInfo.latest_db_date}</b>)</span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
          {/* Trading Date Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
              SELECT TRADING DATE
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                className="btn-secondary"
                onClick={handlePickLatestDate}
                title="Select latest available trading date"
                style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Calendar size={14} color="var(--accent)" />
                Latest Date
              </button>

            </div>
            {selectedDate && (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px' }}>
                Format: <b>{selectedDate >= '2024-07-08' ? 'CM-UDiFF Common Bhavcopy' : 'Legacy Bhavcopy'}</b>
              </div>
            )}
          </div>

          {/* Force Re-download Option */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '40px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={forceRedownload}
                onChange={(e) => setForceRedownload(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              Force re-download / override holiday check
            </label>
          </div>

          {/* Action Trigger Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn-primary"
              onClick={handleDownloadAndImport}
              disabled={importing || !selectedDate}
              style={{
                width: '100%',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: importing ? 'var(--border)' : 'var(--accent)',
              }}
            >
              {importing ? (
                <>
                  <RefreshCw size={16} className="spin-animation" />
                  Streaming & Ingesting In Memory...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download & Import Bhavcopy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Loading Progress Bar */}
        {importing && (
          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent)', fontSize: '13px', fontWeight: 600 }}>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid var(--accent)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span>Fetching official NSE report for {selectedDate}...</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Workflow: Official NSE Archive → In-Memory ZIP Extract → Pandas Parser → Schema Validation → Idempotent Bulk Upsert
            </div>
          </div>
        )}

        {/* Error Notification */}
        {importError && !importing && (
          <div style={{
            marginTop: '20px',
            padding: '14px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--red)',
            borderRadius: '8px',
            color: 'var(--red)',
            fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
              <AlertCircle size={16} />
              Import Failed or Incomplete
            </div>

            <div>{importError}</div>
          </div>
        )}

        {/* Success / Result Breakdown Cards */}
        {importResult && !importing && (
          <div style={{ marginTop: '20px', padding: '18px', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  backgroundColor: importResult.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : importResult.status === 'skipped' ? 'rgba(243, 156, 18, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: importResult.status === 'success' ? '#10b981' : importResult.status === 'skipped' ? '#f39c12' : '#ef4444',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}>
                  {importResult.status === 'success' ? '✓ Import Completed' : importResult.status === 'skipped' ? '⚠ Skipped' : '✕ Failed'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Trading Date: <b>{importResult.trade_date}</b> • Report: <code>{importResult.file_name}</code>
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Format: <b>{importResult.source_format || 'Auto-detected'}</b> • Time: <b>{importResult.execution_time_seconds}s</b>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '14px' }}>
              {importResult.message}
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DOWNLOADED</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {importResult.records_downloaded.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Raw lines</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PARSED</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {importResult.records_parsed.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Valid schema</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: '#10b981' }}>NEW INSERTED</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>
                  {importResult.records_inserted.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Created in DB</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--accent)' }}>UPDATED</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>
                  {importResult.records_updated.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Idempotent upsert</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SKIPPED</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {importResult.records_skipped.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Unchanged</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: importResult.records_rejected > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                  REJECTED
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: importResult.records_rejected > 0 ? 'var(--red)' : 'inherit', marginTop: '4px' }}>
                  {importResult.records_rejected.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Quality issues</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Automated 4:00 PM Scheduler Status Banner */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontWeight: 700, color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            Automated 4:00 PM EOD Scheduler: {schedulerStatus?.status || 'ACTIVE'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Scheduled Daily Ingestion: <b>{schedulerStatus?.configured_time || '16:00 IST'}</b> • Next Run: <b>{schedulerStatus?.next_run_time || 'Today at 4:00 PM IST (16:00:00)'}</b>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'right' }}>
          Misfire grace window: <b>4 hours</b> • Polling backoff: <b>Exponential</b>
        </div>
      </div>

      {/* Architecture Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingestion Policy</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '6px' }}>Zero-Disk In-Memory</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Streams ZIP/CSV directly into memory without intermediate files
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Format Engine</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '6px' }}>CM-UDiFF + Legacy</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Official NSE standard: auto-detects pre/post July 8, 2024 Bhavcopies
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Concurrency & Integrity</div>
          <div style={{ fontSize: '16px', fontWeight: 600, marginTop: '6px' }}>Idempotent Upsert</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Job locking & dialect-aware bulk upsert prevents duplicate data
          </div>
        </div>
      </div>

      {/* Audit History Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('files')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--border)',
              backgroundColor: activeTab === 'files' ? 'var(--accent)' : 'var(--bg-surface)',
              color: activeTab === 'files' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={14} />
            Ingested Files Log ({files.length})
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--border)',
              backgroundColor: activeTab === 'jobs' ? 'var(--accent)' : 'var(--bg-surface)',
              color: activeTab === 'jobs' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={14} />
            Job Runs History ({jobs.length})
          </button>
        </div>
      </div>

      {loading && <LoadingState message="Loading audit history..." />}

      {/* Tab 1: Ingested Files Log */}
      {!loading && activeTab === 'files' && (
        <div className="terminal-table-wrapper">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Trade Date</th>
                <th>File / Report Name</th>
                <th>Format</th>
                <th>Status</th>
                <th>Raw Rows</th>
                <th>Inserted</th>
                <th>Updated</th>
                <th>Rejected</th>
                <th>Ingested At</th>
              </tr>
            </thead>
            <tbody>
              {files.length > 0 ? (
                files.map((f) => (
                  <tr key={f.id}>
                    <td><b>{f.trade_date}</b></td>
                    <td><code>{f.file_name}</code></td>
                    <td><span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{f.source_format}</span></td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: f.status === 'IMPORTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: f.status === 'IMPORTED' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {f.status}
                      </span>
                    </td>
                    <td>{(f.row_count || 0).toLocaleString()}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>+{(f.inserted_count || 0).toLocaleString()}</td>
                    <td style={{ color: 'var(--accent)' }}>{(f.updated_count || 0).toLocaleString()}</td>
                    <td style={{ color: f.rejected_count > 0 ? 'var(--red)' : 'var(--text-dim)' }}>
                      {(f.rejected_count || 0).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                      {f.created_at ? f.created_at.substring(0, 19).replace('T', ' ') : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No Bhavcopy reports ingested yet. Use the downloader above to import.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Job Runs History */}
      {!loading && activeTab === 'jobs' && (
        <div className="terminal-table-wrapper">
          <table className="terminal-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Dates</th>
                <th>Rows Processed</th>
                <th>Started At</th>
                <th>Completed At</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((j) => (
                  <tr key={j.job_id}>
                    <td><code>{j.job_id}</code></td>
                    <td>{j.job_type}</td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: j.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: j.status === 'SUCCESS' ? 'var(--green)' : 'var(--red)',
                      }}>
                        {j.status}
                      </span>
                    </td>
                    <td>{j.total_dates}</td>
                    <td>{(j.total_rows_imported || 0).toLocaleString()}</td>
                    <td>{j.started_at ? j.started_at.substring(0, 19).replace('T', ' ') : '-'}</td>
                    <td>{j.completed_at ? j.completed_at.substring(0, 19).replace('T', ' ') : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No jobs executed yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
