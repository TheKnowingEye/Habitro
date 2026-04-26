import { useState, useRef } from 'react';
import { darken } from '../../lib/darken';

export default function ProofModal({ habit, dark, accent, onSubmit, onClose }) {
  const [caption, setCaption] = useState('');
  const [file,    setFile]    = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const bg      = dark ? '#1A2036' : '#FBF4E6';
  const border  = dark ? 'rgba(78,94,133,0.65)' : 'rgba(62,47,36,0.18)';
  const muted   = dark ? '#B8AE98' : '#7A6555';
  const dimmer  = dark ? '#6B7A8E' : '#AAA090';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: bg,
        borderRadius: '12px 12px 0 0',
        borderTop:  `1px solid ${border}`,
        borderLeft:  `1px solid ${border}`,
        borderRight: `1px solid ${border}`,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
          <div style={{ width: 36, height: 4, background: dark ? 'rgba(184,174,152,0.28)' : 'rgba(62,47,36,0.18)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 16px 12px',
          borderBottom: `1px solid ${dark ? 'rgba(78,94,133,0.35)' : 'rgba(62,47,36,0.1)'}`,
        }}>
          <div>
            <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.12em' }}>
              // SUBMIT PROOF
            </span>
            <div style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dark ? '#F4ECD8' : '#3E2F24', letterSpacing: '0.08em', marginTop: 4, textTransform: 'uppercase' }}>
              {habit?.habits?.name ?? 'HABIT'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: '"Silkscreen",monospace', fontSize: '8px',
              color: muted, letterSpacing: '0.1em', padding: 4,
            }}
          >
            CLOSE ✕
          </button>
        </div>

        {/* Photo picker */}
        <div style={{ padding: '14px 16px 0' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', height: 160,
              background: preview ? 'transparent' : (dark ? 'rgba(30,38,64,0.55)' : 'rgba(62,47,36,0.04)'),
              border: `2px dashed ${dark ? 'rgba(78,94,133,0.55)' : 'rgba(62,47,36,0.22)'}`,
              borderRadius: 4, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, overflow: 'hidden', padding: 0,
            }}
          >
            {preview ? (
              <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <>
                {/* Pixel camera */}
                <svg width="36" height="30" viewBox="0 0 36 30" shapeRendering="crispEdges">
                  <rect x="0"  y="8"  width="36" height="20" fill="none" stroke={muted} strokeWidth="2" opacity="0.45"/>
                  <rect x="13" y="4"  width="10" height="6"  fill={muted} opacity="0.3"/>
                  <rect x="4"  y="10" width="4"  height="4"  fill={muted} opacity="0.25"/>
                  <rect x="12" y="12" width="12" height="10" fill="none" stroke={muted} strokeWidth="2" opacity="0.45"/>
                  <rect x="15" y="15" width="6"  height="4"  fill={muted} opacity="0.2"/>
                </svg>
                <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '9px', color: dimmer, letterSpacing: '0.1em' }}>
                  TAP TO ADD PHOTO
                </span>
              </>
            )}
          </button>
        </div>

        {/* Caption input */}
        <div style={{ padding: '12px 16px 0' }}>
          <span style={{ fontFamily: '"Silkscreen",monospace', fontSize: '8px', color: dimmer, letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
            CAPTION
          </span>
          <input
            type="text"
            maxLength={100}
            placeholder="What did you do?"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? 'rgba(30,38,64,0.5)' : 'rgba(62,47,36,0.04)',
              border: `1px solid ${border}`,
              borderRadius: 4, padding: '10px 12px',
              fontFamily: '"Quicksand",sans-serif', fontSize: '14px',
              color: dark ? '#F4ECD8' : '#3E2F24', outline: 'none',
            }}
          />
        </div>

        {/* Submit */}
        <div style={{ padding: '14px 16px 8px' }}>
          <button
            className="habitro-btn"
            onClick={() => onSubmit({ file, caption: caption.trim() })}
            style={{
              width: '100%', padding: '14px 0',
              background: accent,
              border: 'none',
              boxShadow: `0 4px 0 ${darken(accent, 0.38)}`,
              fontFamily: '"Silkscreen",monospace', fontSize: '11px', fontWeight: 700,
              color: dark ? '#1E2640' : '#FBF4E6',
              letterSpacing: '0.12em', cursor: 'pointer', borderRadius: 4,
            }}
          >
            SUBMIT PROOF
          </button>
        </div>
      </div>
    </div>
  );
}
