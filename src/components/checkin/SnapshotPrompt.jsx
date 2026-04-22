import { useState, useRef } from 'react';
import Button from '../ui/Button';

export default function SnapshotPrompt({ onSubmit, onSkip }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Revoke previous object URL to avoid memory leaks
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  return (
    <div className="snapshot-backdrop" role="dialog" aria-modal="true" aria-label="Upload snapshot">
      <div className="snapshot-sheet">
        <h2 className="snapshot-sheet__title">Prove it</h2>
        <p className="snapshot-sheet__sub">Your opponent will see this in the evidence feed</p>

        <div
          className={`snapshot-dropzone ${preview ? 'snapshot-dropzone--preview' : ''}`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Tap to take or select a photo"
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') inputRef.current?.click(); }}
        >
          {preview ? (
            <img src={preview} alt="Snapshot preview" className="snapshot-preview" />
          ) : (
            <>
              <span className="snapshot-dropzone__icon" aria-hidden="true">📷</span>
              <span className="snapshot-dropzone__label">Tap to take a photo</span>
              <span className="snapshot-dropzone__hint">Camera opens on mobile</span>
            </>
          )}
          {/* Hidden — triggered programmatically so we control the tap area */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="snapshot-input"
            onChange={handleFileChange}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        <div className="snapshot-sheet__actions">
          <Button onClick={() => onSubmit(file)} disabled={!file}>
            {file ? 'Upload & Submit' : 'Select a photo first'}
          </Button>
          <button className="snapshot-skip" onClick={onSkip}>
            Skip — submit without photo
          </button>
        </div>
      </div>
    </div>
  );
}
