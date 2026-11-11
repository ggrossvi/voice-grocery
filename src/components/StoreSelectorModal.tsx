'use client';

/**
 * StoreSelectorModal Component
 * 
 * Allows users to choose their preferred Kroger/QFC/Fred Meyer store:
 * 1. "Use My Current Location" via browser GPS (navigator.geolocation)
 * 2. Zip Code text search
 * 3. Shows the 5 nearest stores with address and banner tags
 */

import React, { useState } from 'react';
import { MapPin, Navigation, Search, Check, X, Loader2, Store } from 'lucide-react';
import { KrogerStoreLocation } from '@/lib/types';

interface StoreSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStore: KrogerStoreLocation | null;
  onSelectStore: (store: KrogerStoreLocation) => void;
}

export function StoreSelectorModal({
  isOpen,
  onClose,
  selectedStore,
  onSelectStore,
}: StoreSelectorModalProps) {
  const [zipCode, setZipCode] = useState('');
  const [stores, setStores] = useState<KrogerStoreLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. "Use My Current Location" via Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Getting your GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setStatusMessage('Finding closest stores within 20 miles...');
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/kroger/locations?lat=${latitude}&long=${longitude}`);
          const data = await res.json();

          if (data.stores && data.stores.length > 0) {
            setStores(data.stores);
            setStatusMessage(null);
          } else {
            setStatusMessage('No Kroger or QFC stores found near your location.');
          }
        } catch (err) {
          setStatusMessage('Failed to fetch stores. Try entering your zip code.');
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        setIsLoading(false);
        setStatusMessage('Location permission denied. Please enter your zip code below.');
      },
      { timeout: 10000 }
    );
  };

  // 2. Search by Zip Code
  const handleZipSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zipCode.trim()) return;

    setIsLoading(true);
    setStatusMessage('Searching stores...');

    try {
      const res = await fetch(`/api/kroger/locations?zip=${encodeURIComponent(zipCode.trim())}`);
      const data = await res.json();

      if (data.stores && data.stores.length > 0) {
        setStores(data.stores);
        setStatusMessage(null);
      } else {
        setStatusMessage(`No stores found for zip code "${zipCode}".`);
      }
    } catch (err) {
      setStatusMessage('Error searching stores. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getChainColor = (chain: string) => {
    const c = chain.toUpperCase();
    if (c.includes('QFC')) return '#10B981'; // Green
    if (c.includes('FRED')) return '#EF4444'; // Red
    return '#0284C7'; // Blue for Kroger
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div className="glass-panel" style={{
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        position: 'relative',
        background: '#0B1120',
        border: '1px solid rgba(56, 189, 248, 0.3)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={20} color="var(--primary-cyan)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Choose Your Store</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Select your local store so product search reflects real-time stock and local pricing.
        </p>

        {/* 1-Tap "Use My Current Location" */}
        <button
          onClick={handleUseCurrentLocation}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, var(--primary-blue), var(--primary-cyan))',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
            marginBottom: '16px',
          }}
        >
          {isLoading ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Navigation size={16} />
          )}
          <span>📍 Use My Current Location</span>
        </button>

        {/* Or Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>or search by zip</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        {/* Zip Code Form */}
        <form onSubmit={handleZipSearch} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            placeholder="Enter Zip Code (e.g. 98101)"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !zipCode.trim()}
            className="confirm-btn yes"
            style={{ padding: '10px 16px', borderRadius: '10px' }}
          >
            <Search size={16} />
          </button>
        </form>

        {/* Status Message */}
        {statusMessage && (
          <p style={{ fontSize: '0.8rem', color: '#F59E0B', marginBottom: '14px', textAlign: 'center' }}>
            {statusMessage}
          </p>
        )}

        {/* 5 Stores List */}
        {stores.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-cyan)' }}>
              Closest Stores (within 20 miles):
            </p>
            {stores.map((store) => {
              const isSelected = selectedStore?.locationId === store.locationId;
              const chainColor = getChainColor(store.chain);

              return (
                <div
                  key={store.locationId}
                  onClick={() => {
                    onSelectStore(store);
                    onClose();
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: isSelected ? 'rgba(2, 132, 199, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSelected ? 'var(--primary-cyan)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: chainColor,
                        background: `${chainColor}22`,
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        {store.chain}
                      </span>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {store.name}
                      </p>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {store.address.addressLine1}, {store.address.city}, {store.address.state} {store.address.zipCode}
                    </p>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isSelected ? (
                      <span style={{ color: '#34D399', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        <Check size={16} />
                        Active
                      </span>
                    ) : (
                      <button
                        className="confirm-btn yes"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '8px' }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
