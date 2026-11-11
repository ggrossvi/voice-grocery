'use client';

/**
 * Main Home Page - VoiceGroceries
 * 
 * Supports:
 * - 5-Store Locator with "Use My Location" GPS
 * - Voice and text grocery ordering
 * - Live Kroger / QFC catalog queries
 * - Staples & usual items memory
 */

import React, { useState, useEffect } from 'react';
import { ShoppingBag, MapPin } from 'lucide-react';
import { VoiceAssistantHero } from '@/components/VoiceAssistantHero';
import { StaplesList } from '@/components/StaplesList';
import { ActiveCartDrawer } from '@/components/ActiveCartDrawer';
import { AssistantInstructionsModal } from '@/components/AssistantInstructionsModal';
import { StoreSelectorModal } from '@/components/StoreSelectorModal';
import { UsualItem, CartItem, KrogerStoreLocation } from '@/lib/types';

export default function Home() {
  const [staples, setStaples] = useState<UsualItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<KrogerStoreLocation | null>(null);

  // Load saved staples and preferred store from storage on mount
  useEffect(() => {
    fetchStaples();

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

  const handleSelectStore = (store: KrogerStoreLocation) => {
    setSelectedStore(store);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kroger_preferred_store', JSON.stringify(store));
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
    setCartItems(prev => [newCartItem, ...prev]);
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

      {/* Voice Assistant Core */}
      <VoiceAssistantHero 
        onItemAdded={handleItemAdded} 
        onOpenInstructions={() => setIsAssistantModalOpen(true)}
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
