'use client';

/**
 * Main Home Page - VoiceGroceries
 * 
 * Supports:
 * - Google Sign-In (`userId` = Google `sub` ID + `email`)
 * - Connecting Kroger / QFC account to Google profile
 * - Cart reminders when items are waiting in the user's cart
 * - 5-Store Locator with "Use My Location" GPS
 * - Voice and text grocery ordering
 * - Live Kroger / QFC catalog queries
 * - Staples & usual items memory
 */

import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin, UserCheck, Link2, Bell, LogOut } from 'lucide-react';
import { VoiceAssistantHero } from '@/components/VoiceAssistantHero';
import { StaplesList } from '@/components/StaplesList';
import { ActiveCartDrawer } from '@/components/ActiveCartDrawer';
import { AssistantInstructionsModal } from '@/components/AssistantInstructionsModal';
import { StoreSelectorModal } from '@/components/StoreSelectorModal';
import { UsualItem, CartItem, KrogerStoreLocation, UserProfile } from '@/lib/types';

export default function Home() {
  const [staples, setStaples] = useState<UsualItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cartReminder, setCartReminder] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<KrogerStoreLocation | null>(null);

  // Load saved staples, authenticated Google user + Kroger link status, and preferred store on mount
  useEffect(() => {
    fetchStaples();
    fetchAuthSession();

    // Check localStorage for saved store
    if (typeof window !== 'undefined') {
      const savedStore = localStorage.getItem('kroger_preferred_store');
      if (savedStore) {
        try {
          setSelectedStore(JSON.parse(savedStore));
        } catch (e) {}
      }
    }
  }, []);

  const fetchAuthSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
        if (Array.isArray(data.cartItems) && data.cartItems.length > 0) {
          setCartItems(data.cartItems);
        }
        setCartReminder(data.cartReminder || null);

        // If user has a preferred store saved in Neon, sync it to UI
        if (data.user.preferredStoreId) {
          setSelectedStore(prev => {
            if (prev && prev.locationId === data.user.preferredStoreId) return prev;
            const syncedStore: KrogerStoreLocation = {
              locationId: data.user.preferredStoreId,
              name: data.user.preferredStoreName || `Store #${data.user.preferredStoreId}`,
              chain: data.user.preferredStoreChain || 'QFC',
              address: { addressLine1: '', city: '', state: '', zipCode: '' },
            };
            if (typeof window !== 'undefined') {
              localStorage.setItem('kroger_preferred_store', JSON.stringify(syncedStore));
            }
            return syncedStore;
          });
        }
      } else {
        setUser(null);
        setCartReminder(null);
      }
    } catch (err) {
      console.error('Failed to load auth session:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/me', { method: 'DELETE' });
      setUser(null);
      setCartReminder(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const fetchStaples = async () => {
    try {
      const res = await fetch('/api/usuals');
      const data = await res.json();
      if (data.items) {
        setStaples(data.items);
      }
    } catch (err) {
      console.error('Failed to load staples:', err);
    }
  };

  const handleSelectStore = async (store: KrogerStoreLocation) => {
    setSelectedStore(store);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kroger_preferred_store', JSON.stringify(store));
    }

    // Persist preferred Home Store to Neon if signed in
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: store.locationId,
          name: store.name,
          chain: store.chain,
        }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to save preferred store to database:', err);
    }
  };

  const handleItemAdded = (item: UsualItem) => {
    const newCartItem: CartItem = {
      id: `cart-${Date.now()}`,
      upc: item.krogerUpc,
      title: item.title,
      brand: item.brand,
      size: item.size,
      price: item.lastPrice,
      imageUrl: item.imageUrl,
      quantity: 1,
      addedAt: new Date().toISOString(),
    };
    setCartItems(prev => {
      const updated = [newCartItem, ...prev];
      if (user) {
        setCartReminder(`Reminder for ${user.email}: You have ${updated.length} item(s) waiting in your Kroger cart.`);
      }
      return updated;
    });
    fetchStaples();
  };

  const handleQuickAdd = async (item: UsualItem) => {
    setIsAddingToCart(true);
    try {
      const response = await fetch('/api/kroger/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, quantity: 1 }),
      });
      const data = await response.json();
      if (data.success) {
        handleItemAdded(item);
      }
    } catch (err) {
      console.error('Quick add error:', err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <main className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-badge">
          <div className="brand-icon">
            <ShoppingBag size={20} color="white" />
          </div>
          <div>
            <h1 className="brand-title">GroceryVoice</h1>
            <p className="brand-subtitle">Kroger & QFC</p>
          </div>
        </div>

        {/* Store Selector Pill */}
        <button 
          onClick={() => setIsStoreModalOpen(true)}
          className="status-pill sandbox"
          style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title="Click to choose your local store"
        >
          <MapPin size={13} style={{ flexShrink: 0, color: 'var(--primary-cyan)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedStore ? `${selectedStore.chain} - ${selectedStore.name}` : '📍 Choose Store'}
          </span>
        </button>
      </header>

      {/* Google Sign-In & Kroger Account Link Bar */}
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '10px 14px',
          marginBottom: '12px',
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.78rem',
        }}
      >
        {!user ? (
          <>
            <span style={{ color: 'var(--text-secondary)' }}>
              Sign in with Google to link your Kroger account &amp; get cart reminders
            </span>
            <a
              href="/api/auth/google"
              className="status-pill connected"
              style={{ textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              <UserCheck size={13} />
              <span>Sign in with Google</span>
            </a>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="status-pill connected" title={`Google ID: ${user.id}`}>
                <UserCheck size={13} />
                <span>{user.email}</span>
              </span>

              {user.krogerConnected ? (
                <span className="status-pill connected">
                  <Link2 size={13} />
                  <span>Kroger Linked</span>
                </span>
              ) : (
                <a
                  href="/api/auth/kroger"
                  className="status-pill sandbox"
                  style={{ textDecoration: 'none', cursor: 'pointer' }}
                >
                  <Link2 size={13} />
                  <span>Connect Kroger Account</span>
                </a>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="status-pill sandbox"
              style={{ cursor: 'pointer', background: 'transparent' }}
              title="Sign out"
            >
              <LogOut size={12} />
              <span>Sign out</span>
            </button>
          </>
        )}
      </section>

      {/* Cart Reminder Notification Banner */}
      {cartReminder && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.78rem',
            color: '#a7f3d0',
          }}
        >
          <Bell size={15} style={{ flexShrink: 0 }} />
          <span>{cartReminder}</span>
        </div>
      )}

      {/* Voice Assistant Core */}
      <VoiceAssistantHero 
        onItemAdded={handleItemAdded} 
        onOpenInstructions={() => setIsAssistantModalOpen(true)}
        selectedStoreId={selectedStore?.locationId || user?.preferredStoreId}
      />

      {/* Active Session Cart Drawer */}
      <ActiveCartDrawer items={cartItems} />

      {/* Staples & Usual Items Memory Grid */}
      <StaplesList 
        staples={staples} 
        onQuickAdd={handleQuickAdd}
        isAddingToCart={isAddingToCart}
      />

      {/* Wake Word Guide Modal ("Hey Google" & "Hey Siri") */}
      <AssistantInstructionsModal 
        isOpen={isAssistantModalOpen} 
        onClose={() => setIsAssistantModalOpen(false)} 
      />

      {/* 5-Store Locator Modal */}
      <StoreSelectorModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        selectedStore={selectedStore}
        onSelectStore={handleSelectStore}
      />

      {/* Footer Info */}
      <footer style={{
        marginTop: 'auto',
        paddingTop: '24px',
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--text-muted)',
      }}>
        <p>Voice Groceries • Works with Kroger, QFC & Fred Meyer</p>
      </footer>
    </main>
  );
}
