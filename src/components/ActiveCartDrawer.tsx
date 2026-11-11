'use client';

/**
 * ActiveCartDrawer Component
 * 
 * Displays items added to the Kroger cart in this session.
 */

import React from 'react';
import { ShoppingCart, ExternalLink, CheckCircle } from 'lucide-react';
import { CartItem } from '@/lib/types';

interface ActiveCartDrawerProps {
  items: CartItem[];
}

export function ActiveCartDrawer({ items }: ActiveCartDrawerProps) {
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  return (
    <section className="glass-panel cart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={18} color="var(--primary-cyan)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700 }}>Active Kroger Cart</h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle size={13} />
          {items.length} item{items.length > 1 ? 's' : ''} added
        </span>
      </div>

      <div>
        {items.map((cartItem) => (
          <div key={cartItem.id} className="cart-item-row">
            <div className="cart-item-info">
              <span className="cart-item-name">{cartItem.title}</span>
              <span className="cart-item-details">
                Qty: {cartItem.quantity} {cartItem.size ? `• ${cartItem.size}` : ''}
              </span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#34D399' }}>
              ${cartItem.price ? (cartItem.price * cartItem.quantity).toFixed(2) : '3.29'}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '14px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: varDefaultTextMuted() }}>Est. Subtotal</span>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            ${total.toFixed(2)}
          </p>
        </div>

        <a 
          href="https://www.kroger.com/cart" 
          target="_blank" 
          rel="noopener noreferrer"
          className="confirm-btn yes"
          style={{ textDecoration: 'none', padding: '8px 14px', fontSize: '0.82rem', flex: 'none' }}
        >
          <span>Open Kroger Cart</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </section>
  );
}

function varDefaultTextMuted() {
  return 'var(--text-muted)';
}
