'use client';

/**
 * VoiceAssistantHero Component
 * 
 * Supports:
 * 1. Single staple confirmations ("Found your usual milk...")
 * 2. Multi-option live store selector ("I found 4 yogurt options at Kroger...")
 * 3. Voice and text input without page reloads
 */

import React, { useState } from 'react';
import { Mic, Volume2, Check, X, Sparkles, HelpCircle, Send, AlertCircle, Loader2, ShoppingCart } from 'lucide-react';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { UsualItem, KrogerProduct } from '@/lib/types';

interface VoiceAssistantHeroProps {
  onItemAdded: (item: UsualItem) => void;
  onOpenInstructions: () => void;
  selectedStoreId?: string;
}

export function VoiceAssistantHero({
  onItemAdded,
  onOpenInstructions,
  selectedStoreId,
}: VoiceAssistantHeroProps) {
  const {
    status,
    transcript,
    assistantSpeech,
    pendingConfirmation,
    errorMessage,
    isProcessing,
    startListening,
    stopListening,
    submitTextQuery,
    confirmPendingItem,
    selectProductOption,
  } = useVoiceAssistant(onItemAdded, selectedStoreId);

  const [typedInput, setTypedInput] = useState('');

  const isListening = status === 'listening';
  const isThinking = status === 'thinking' || isProcessing;
  const isSpeaking = status === 'speaking';
  const isConfirming = status === 'confirming';

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSend = () => {
    if (!typedInput.trim() || isThinking) return;
    submitTextQuery(typedInput);
    setTypedInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const getItemTitle = (item: KrogerProduct | UsualItem) => {
    return 'description' in item ? item.description : item.title;
  };

  const getItemPrice = (item: KrogerProduct | UsualItem) => {
    const priceVal = 'lastPrice' in item ? item.lastPrice : ('price' in item ? item.price : undefined);
    return priceVal ? `$${priceVal.toFixed(2)}` : '$3.29';
  };

  return (
    <section className="glass-panel voice-hero">
      {/* Wake Word Helper Pill */}
      <button 
        onClick={onOpenInstructions}
        className="status-pill sandbox" 
        style={{ marginBottom: '16px', border: '1px solid rgba(56, 189, 248, 0.4)' }}
        title="Setup Hey Google and Siri wake words"
      >
        <Sparkles size={14} />
        <span>Use "Hey Google" & "Hey Siri"</span>
        <HelpCircle size={13} style={{ opacity: 0.7 }} />
      </button>

      {/* Central Animated Mic Button */}
      <div className="mic-button-wrapper">
        {isListening && (
          <>
            <div className="pulse-ring" />
            <div className="pulse-ring" />
          </>
        )}

        <button
          onClick={handleMicClick}
          className={`mic-button ${isListening ? 'listening' : ''} ${isThinking ? 'thinking' : ''}`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? (
            <Mic size={44} style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.7))' }} />
          ) : isThinking ? (
            <Loader2 size={40} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Mic size={40} />
          )}
        </button>
      </div>

      {/* Voice Status Indicator Text */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '6px' }}>
        {isListening ? 'Listening to you...' :
         isThinking ? 'Searching Kroger catalog...' :
         isSpeaking ? 'Speaking...' :
         isConfirming ? (pendingConfirmation?.options ? 'Select an option below:' : 'Awaiting confirmation...') :
         'Tap to speak'}
      </h2>

      {/* Sound wave visualizer bars */}
      {(isListening || isSpeaking) && (
        <div className="sound-waves">
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
          <div className="wave-bar" />
        </div>
      )}

      {/* Live transcript preview */}
      {transcript && (
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--primary-cyan)',
          marginTop: '12px',
          fontStyle: 'italic',
          background: 'rgba(56, 189, 248, 0.08)',
          padding: '4px 12px',
          borderRadius: '999px',
        }}>
          "{transcript}"
        </p>
      )}

      {/* Error Warning Banner */}
      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#F87171',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '8px 12px',
          fontSize: '0.8rem',
          marginTop: '12px',
          textAlign: 'left',
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Spoken feedback bubble */}
      <div className="feedback-box">
        <div className="feedback-badge">
          <Volume2 size={13} />
          <span>Assistant</span>
        </div>
        <p className="feedback-text">{assistantSpeech}</p>

        {/* ----------------------------------------------------------------- */}
        {/* CASE A: Single Item Confirmation Card                             */}
        {/* ----------------------------------------------------------------- */}
        {pendingConfirmation && pendingConfirmation.item && (
          <div style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '12px',
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {pendingConfirmation.item.imageUrl && (
                <img 
                  src={pendingConfirmation.item.imageUrl} 
                  alt="" 
                  style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {getItemTitle(pendingConfirmation.item)}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {pendingConfirmation.item.size} • 
                  <span style={{ color: '#34D399', fontWeight: 700, marginLeft: '4px' }}>
                    {getItemPrice(pendingConfirmation.item)}
                  </span>
                </p>
              </div>
            </div>

            <div className="confirmation-actions">
              <button 
                onClick={() => confirmPendingItem(true)} 
                className="confirm-btn yes"
              >
                <Check size={16} />
                <span>Yes, Add to Cart</span>
              </button>
              <button 
                onClick={() => confirmPendingItem(false)} 
                className="confirm-btn no"
              >
                <X size={16} />
                <span>No, Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* CASE B: Multiple Kroger Store Options List                        */}
        {/* ----------------------------------------------------------------- */}
        {pendingConfirmation && pendingConfirmation.options && pendingConfirmation.options.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-cyan)', marginBottom: '10px' }}>
              Live Options from Your Home Store:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingConfirmation.options.map((option) => (
                <div 
                  key={option.upc}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    gap: '10px',
                  }}
                >
                  {option.imageUrl && (
                    <img 
                      src={option.imageUrl} 
                      alt="" 
                      style={{ width: '42px', height: '42px', borderRadius: '6px', objectFit: 'cover' }} 
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {option.description}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {option.brand} {option.size ? `• ${option.size}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34D399' }}>
                      {option.price ? `$${option.price.toFixed(2)}` : '$3.49'}
                    </span>
                    <button
                      onClick={() => selectProductOption(option)}
                      className="confirm-btn yes"
                      style={{ padding: '6px 10px', fontSize: '0.75rem', flex: 'none' }}
                      title="Choose this item"
                    >
                      <ShoppingCart size={13} />
                      <span>Choose</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => confirmPendingItem(false)}
              className="confirm-btn no"
              style={{ marginTop: '10px', width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Text Command Input Bar */}
      <div 
        style={{
          display: 'flex',
          gap: '8px',
          width: '100%',
          marginTop: '14px',
        }}
      >
        <input
          type="text"
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type an item (e.g. 'yogurt', 'milk', 'apples')..."
          disabled={isThinking}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isThinking || !typedInput.trim()}
          className="confirm-btn yes"
          style={{
            flex: 'none',
            padding: '10px 14px',
            borderRadius: '12px',
            opacity: isThinking || !typedInput.trim() ? 0.6 : 1,
          }}
          aria-label="Send command"
        >
          {isThinking ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
      </div>
    </section>
  );
}
