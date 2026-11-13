'use client';

/**
 * FavoritesList Component
 *
 * Displays and manages the signed-in user's "Favorite Items" memory.
 * Features:
 * - 2-column mobile-optimized cards
 * - Shows trigger keywords, product details, and price
 * - Shows order count frequency badge
 * - 1-tap quick add to Kroger cart
 */

import React from 'react';
import { Plus, Flame, FileDown } from 'lucide-react';
import { FavoriteItem } from '@/lib/types';

interface FavoritesListProps {
  favorites: FavoriteItem[];
  onQuickAdd: (item: FavoriteItem) => void;
  onOpenImportModal?: () => void;
  isAddingToCart?: boolean;
}

export function FavoritesList({
  favorites,
  onQuickAdd,
  onOpenImportModal,
  isAddingToCart,
}: FavoritesListProps) {
  return (
    <section style={{ marginTop: '8px' }}>
      <div className="section-header">
        <div>
          <h3 className="section-title">Your Favorites</h3>
          <p className="section-subtitle">Say any keyword to re-order your favorite brand</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="status-pill sandbox"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.73rem',
              }}
              title="Import UPCs from a past Kroger or QFC receipt"
            >
              <FileDown size={13} style={{ color: 'var(--primary-cyan)' }} />
              <span>Import Past Items</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 600 }}>
            <Flame size={14} />
            <span>Smart Memory</span>
          </div>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
          }}
        >
          No favorites saved yet — speak or type an item above to add your first favorite!
        </div>
      ) : (
        <div className="staples-grid">
          {favorites.map((item) => (
            <div
              key={item.id}
              className="glass-panel staple-card"
              onClick={() => onQuickAdd(item)}
              title={`Tap to add ${item.title} to your Kroger cart`}
            >
              <div className="staple-top">
                <span className="staple-keyword">{item.spokenKeyword}</span>
                <span className="order-count-badge">
                  {item.orderCount} orders
                </span>
              </div>

              <p className="staple-title">{item.title}</p>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {item.size || item.brand || 'Kroger'}
              </p>

              <div className="staple-bottom">
                <span className="staple-price">
                  ${item.lastPrice ? item.lastPrice.toFixed(2) : '3.29'}
                </span>

                <button
                  className="quick-add-btn"
                  aria-label={`Add ${item.title} to cart`}
                  disabled={isAddingToCart}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

