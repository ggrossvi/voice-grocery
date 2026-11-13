'use client';

/**
 * ImportFavoritesModal Component
 *
 * Allows signed-in shoppers to quickly seed their "Your Favorites" memory
 * by pasting 10-to-13 digit UPC numbers from a Kroger/QFC receipt or online
 * past-order page, optionally paired with a spoken voice keyword.
 *
 * Example lines:
 *   0068954408301, greek yogurt
 *   0001111041600, milk
 *   68954408302
 */

import React, { useState } from 'react';
import { FileDown, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { FavoriteItem } from '@/lib/types';

interface ImportFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedItems: FavoriteItem[]) => void;
  selectedStoreId?: string;
}

interface ImportSummaryState {
  importedCount: number;
  notFoundUpcs: string[];
}

export function ImportFavoritesModal({
  isOpen,
  onClose,
  onImportSuccess,
  selectedStoreId,
}: ImportFavoritesModalProps) {
  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummaryState | null>(null);

  if (!isOpen) return null;

  /**
   * Submits the pasted UPC lines to `POST /api/favorites/import` and updates
   * the parent Favorites list when items are matched in the Kroger catalog.
   */
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSummary(null);

    try {
      const response = await fetch('/api/favorites/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          locationId: selectedStoreId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.error || 'Could not import items. Please check your UPC numbers.'
        );
        return;
      }

      const importedItems: FavoriteItem[] = data.imported || [];
      const notFoundUpcs: string[] = data.notFound || [];

      setSummary({
        importedCount: importedItems.length,
        notFoundUpcs,
      });

      if (importedItems.length > 0) {
        onImportSuccess(importedItems);
        setRawText('');
      }
    } catch (error) {
      setErrorMessage('Network error while importing items. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          position: 'relative',
          background: '#0B1120',
          border: '1px solid rgba(56, 189, 248, 0.3)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={20} color="var(--primary-cyan)" />
            <h3 style={{ fontSize: '1.12rem', fontWeight: 700 }}>
              Import Past Order Items
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close import modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            marginBottom: '14px',
            lineHeight: 1.45,
          }}
        >
          Paste item numbers (UPCs) from your Kroger or QFC receipt or online
          Purchase History (one per line). You can optionally add a comma and
          the voice shortcut you want to say.
        </p>

        <form onSubmit={handleImportSubmit}>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={5}
            placeholder={
              '0068954408301, greek yogurt\n0001111041600, milk\n68954408302'
            }
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.84rem',
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
              marginBottom: '14px',
            }}
          />

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#FCA5A5',
                fontSize: '0.78rem',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Import Result Summary Banner */}
          {summary && (
            <div
              style={{
                padding: '10px 12px',
                marginBottom: '12px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.14)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#A7F3D0',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>
                  Imported <strong>{summary.importedCount}</strong> favorite
                  item(s)!
                </span>
              </div>
              {summary.notFoundUpcs.length > 0 && (
                <p style={{ marginTop: '6px', color: '#FDE68A' }}>
                  Could not find in catalog:{' '}
                  {summary.notFoundUpcs.join(', ')}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="confirm-btn no"
              style={{ padding: '10px 16px', borderRadius: '10px' }}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !rawText.trim()}
              className="confirm-btn yes"
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    size={15}
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                  <span>Looking up UPCs...</span>
                </>
              ) : (
                <>
                  <FileDown size={15} />
                  <span>Import Favorites</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
