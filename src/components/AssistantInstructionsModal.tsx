'use client';

/**
 * AssistantInstructionsModal Component
 * 
 * Interactive guide showing how to connect:
 * 1. "Hey Google" on Android via Google Assistant Routine
 * 2. "Hey Siri" on Apple via Siri Shortcuts
 * Includes a live interactive webhook tester.
 */

import React, { useState } from 'react';
import { X, Smartphone, Apple, Sparkles, Send, Check } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantInstructionsModal({ isOpen, onClose }: ModalProps) {
  const [activeTab, setActiveTab] = useState<'android' | 'apple'>('android');
  const [testQuery, setTestQuery] = useState('milk');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  // Test the webhook directly from the modal
  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/assistant/webhook?item=${encodeURIComponent(testQuery)}`);
      const data = await res.json();
      setTestResult(data.spokenText || 'Item processed');
    } catch (err) {
      setTestResult('Error reaching webhook');
    } finally {
      setIsTesting(false);
    }
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
        maxWidth: '460px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        position: 'relative',
        background: '#0B1120',
        border: '1px solid rgba(56, 189, 248, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--primary-cyan)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hands-Free Wake Words</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Platform Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => setActiveTab('android')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'android' ? 'var(--primary-blue)' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Smartphone size={15} />
            <span>Android ("Hey Google")</span>
          </button>

          <button
            onClick={() => setActiveTab('apple')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'apple' ? 'var(--primary-blue)' : 'transparent',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Apple size={15} />
            <span>Apple ("Hey Siri")</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'android' ? (
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '10px', color: 'var(--text-main)', fontWeight: 600 }}>
              How to set up "Hey Google" on Android:
            </p>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Open the <strong>Google Assistant</strong> or <strong>Google Home</strong> app.</li>
              <li>Go to <strong>Settings $\rightarrow$ Routines $\rightarrow$ New Routine</strong>.</li>
              <li>Under <em>Starter</em>, add: <br/><code style={{ color: 'var(--primary-cyan)', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: '4px' }}>"When I say: Add $ to groceries"</code></li>
              <li>Under <em>Action</em>, select <strong>Open Web Address</strong> or trigger the webhook URL below.</li>
            </ol>
          </div>
        ) : (
          <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '10px', color: 'var(--text-main)', fontWeight: 600 }}>
              How to set up "Hey Siri" on iPhone / Apple Watch:
            </p>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Open the native <strong>Shortcuts</strong> app on iOS.</li>
              <li>Tap <strong>+</strong> to create a new shortcut named <strong>"Add Grocery"</strong>.</li>
              <li>Add action: <strong>"Ask for Input"</strong> (Prompt: <em>"What item?"</em>).</li>
              <li>Add action: <strong>"Get contents of URL"</strong> $\rightarrow$ point to the webhook endpoint below.</li>
              <li>Add action: <strong>"Speak Text"</strong> with the response.</li>
              <li>Say: <em>"Hey Siri, Add Grocery"</em> from your iPhone, Watch, or AirPods!</li>
            </ol>
          </div>
        )}

        {/* Live Webhook Tester */}
        <div style={{
          marginTop: '20px',
          padding: '14px',
          borderRadius: '12px',
          background: 'rgba(2, 132, 199, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-cyan)', marginBottom: '8px' }}>
            Test Your Assistant Webhook Live
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="e.g. milk, eggs, bread"
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                color: 'white',
                fontSize: '0.85rem',
              }}
            />
            <button
              onClick={handleTestWebhook}
              disabled={isTesting}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary-blue)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Send size={13} />
              <span>{isTesting ? 'Testing...' : 'Test'}</span>
            </button>
          </div>

          {testResult && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34D399',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Check size={14} />
              <span>{testResult}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
