import { describe, it, expect, beforeEach } from 'vitest';
import {
  bufferKey,
  loadBuffer,
  saveBuffer,
  clearBuffer,
  markBufferSynced
} from './offline-buffer';

const SESSION_ID = 'ckxxxxxxxxxxxxxxxxxxxxxx';
const DISTANCE = 18;

describe('offline-buffer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('bufferKey is deterministic and scoped', () => {
    expect(bufferKey(SESSION_ID, DISTANCE)).toBe(
      `archery:scoreSet:v1:${SESSION_ID}:${DISTANCE}`
    );
    expect(bufferKey(SESSION_ID, 70)).not.toBe(bufferKey(SESSION_ID, 18));
  });

  it('loadBuffer returns null when nothing stored', () => {
    expect(loadBuffer(SESSION_ID, DISTANCE)).toBeNull();
  });

  it('round-trips a buffer via saveBuffer + loadBuffer', () => {
    const arrows = [
      { endNumber: 1, arrowNumber: 1, value: 10 as const },
      { endNumber: 1, arrowNumber: 2, value: 'X' as const },
      { endNumber: 1, arrowNumber: 3, value: 'M' as const }
    ];
    const saved = saveBuffer({
      sessionId: SESSION_ID,
      distance: DISTANCE,
      arrows,
      dirty: true,
      savedAt: null
    });
    expect(saved).not.toBeNull();
    expect(saved!.version).toBe(1);
    expect(saved!.updatedAt).toBeGreaterThan(0);

    const loaded = loadBuffer(SESSION_ID, DISTANCE);
    expect(loaded).not.toBeNull();
    expect(loaded!.arrows).toEqual(arrows);
    expect(loaded!.dirty).toBe(true);
    expect(loaded!.savedAt).toBeNull();
  });

  it('clearBuffer removes the entry', () => {
    saveBuffer({
      sessionId: SESSION_ID,
      distance: DISTANCE,
      arrows: [{ endNumber: 1, arrowNumber: 1, value: 9 }],
      dirty: true,
      savedAt: null
    });
    expect(loadBuffer(SESSION_ID, DISTANCE)).not.toBeNull();
    clearBuffer(SESSION_ID, DISTANCE);
    expect(loadBuffer(SESSION_ID, DISTANCE)).toBeNull();
  });

  it('markBufferSynced flips dirty to false and sets savedAt', () => {
    const arrows = [{ endNumber: 1, arrowNumber: 1, value: 8 as const }];
    saveBuffer({
      sessionId: SESSION_ID,
      distance: DISTANCE,
      arrows,
      dirty: true,
      savedAt: null
    });
    const synced = markBufferSynced(SESSION_ID, DISTANCE, arrows);
    expect(synced).not.toBeNull();
    expect(synced!.dirty).toBe(false);
    expect(synced!.savedAt).toBeGreaterThan(0);
  });

  it('discards buffers with mismatched session or distance', () => {
    saveBuffer({
      sessionId: SESSION_ID,
      distance: DISTANCE,
      arrows: [{ endNumber: 1, arrowNumber: 1, value: 7 }],
      dirty: true,
      savedAt: null
    });
    // Tamper the underlying JSON to simulate corruption / migration drift.
    const key = bufferKey(SESSION_ID, DISTANCE);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 99,
        sessionId: SESSION_ID,
        distance: DISTANCE,
        arrows: [],
        dirty: false,
        savedAt: 0,
        updatedAt: 0
      })
    );
    expect(loadBuffer(SESSION_ID, DISTANCE)).toBeNull();
    // And the tampered entry was removed.
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('returns null when JSON is unparseable', () => {
    window.localStorage.setItem(bufferKey(SESSION_ID, DISTANCE), 'not-json');
    expect(loadBuffer(SESSION_ID, DISTANCE)).toBeNull();
  });

  it('isolates different sessions and distances', () => {
    saveBuffer({
      sessionId: SESSION_ID,
      distance: 18,
      arrows: [{ endNumber: 1, arrowNumber: 1, value: 10 }],
      dirty: true,
      savedAt: null
    });
    saveBuffer({
      sessionId: SESSION_ID,
      distance: 70,
      arrows: [{ endNumber: 1, arrowNumber: 1, value: 'M' }],
      dirty: true,
      savedAt: null
    });
    expect(loadBuffer(SESSION_ID, 18)!.arrows[0].value).toBe(10);
    expect(loadBuffer(SESSION_ID, 70)!.arrows[0].value).toBe('M');
  });
});
