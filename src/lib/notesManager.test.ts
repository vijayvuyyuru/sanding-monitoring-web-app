// filepath: /Users/jason/code/sanding-monitoring-web-app/src/lib/notesManager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotesManager, PassNote } from './notesManager';
import * as VIAM from "@viamrobotics/sdk";

// Mock ViamClient's dataClient methods
const mockDataClient = {
  binaryDataCaptureUpload: vi.fn(),
  binaryDataByFilter: vi.fn(),
  deleteBinaryDataByIds: vi.fn(),
};

const mockViamClient = {
  dataClient: mockDataClient,
} as unknown as VIAM.ViamClient;

describe('NotesManager', () => {
  let notesManager: NotesManager;
  const machineId = 'test-machine-id';
  const passId = 'test-pass-id';
  const partId = 'test-part-id';

  beforeEach(() => {
    notesManager = new NotesManager(mockViamClient, machineId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('savePassNote', () => {
    it('should save a note and return the note data', async () => {
      const noteText = 'This is a test note.';

      // Mock deleteOldNotes to prevent it from running during this test
      vi.spyOn(notesManager, 'deleteOldNotes').mockResolvedValue(undefined);

      const result = await notesManager.savePassNote(passId, noteText, partId);

      expect(mockDataClient.binaryDataCaptureUpload).toHaveBeenCalledOnce();
      const [binaryData, calledPartId, , , , , , tags] = mockDataClient.binaryDataCaptureUpload.mock.calls[0];

      const noteJson = new TextDecoder().decode(binaryData);
      const noteData = JSON.parse(noteJson);

      expect(noteData.pass_id).toBe(passId);
      expect(noteData.note_text).toBe(noteText);
      expect(calledPartId).toBe(partId);
      expect(tags).toContain(`pass:${passId}`);

      expect(result.note_text).toBe(noteText);
      expect(notesManager.deleteOldNotes).toHaveBeenCalledWith(passId);
    });
  });

  describe('fetchPassNotes', () => {
    it('should fetch and sort notes correctly', async () => {
      const note1: PassNote = { pass_id: passId, note_text: 'Older note', created_at: new Date(Date.now() - 1000).toISOString(), created_by: 'test' };
      const note2: PassNote = { pass_id: passId, note_text: 'Newer note', created_at: new Date().toISOString(), created_by: 'test' };

      const mockBinaryData = [
        { binary: new TextEncoder().encode(JSON.stringify(note1)) },
        { binary: new TextEncoder().encode(JSON.stringify(note2)) },
      ];

      mockDataClient.binaryDataByFilter.mockResolvedValue({ data: mockBinaryData });

      const notes = await notesManager.fetchPassNotes(passId);

      expect(mockDataClient.binaryDataByFilter).toHaveBeenCalledOnce();
      expect(notes).toHaveLength(2);
      expect(notes[0].note_text).toBe('Newer note');
      expect(notes[1].note_text).toBe('Older note');
    });
  });

  describe('deleteOldNotes', () => {
    it('should delete all but the most recent note', async () => {
      const now = Date.now();
      const note1 = { pass_id: passId, note_text: 'Oldest', created_at: new Date(now - 2000).toISOString(), created_by: 'test' };
      const note2 = { pass_id: passId, note_text: 'Newest', created_at: new Date(now).toISOString(), created_by: 'test' };
      const note3 = { pass_id: passId, note_text: 'Middle', created_at: new Date(now - 1000).toISOString(), created_by: 'test' };

      const mockBinaryData = [
        { metadata: { binaryDataId: 'id1' }, binary: new TextEncoder().encode(JSON.stringify(note1)) },
        { metadata: { binaryDataId: 'id2' }, binary: new TextEncoder().encode(JSON.stringify(note2)) },
        { metadata: { binaryDataId: 'id3' }, binary: new TextEncoder().encode(JSON.stringify(note3)) },
      ];

      mockDataClient.binaryDataByFilter.mockResolvedValue({ data: mockBinaryData });

      await notesManager.deleteOldNotes(passId);

      expect(mockDataClient.deleteBinaryDataByIds).toHaveBeenCalledOnce();
      const [idsToDelete] = mockDataClient.deleteBinaryDataByIds.mock.calls[0];

      expect(idsToDelete).toHaveLength(2);
      expect(idsToDelete).toContain('id1'); // Oldest
      expect(idsToDelete).toContain('id3'); // Middle
      expect(idsToDelete).not.toContain('id2'); // Newest
    });

    it('should not delete anything if only one note exists', async () => {
      const note = { pass_id: passId, note_text: 'Single note', created_at: new Date().toISOString(), created_by: 'test' };
      const mockBinaryData = [
        { metadata: { binaryDataId: 'id1' }, binary: new TextEncoder().encode(JSON.stringify(note)) },
      ];

      mockDataClient.binaryDataByFilter.mockResolvedValue({ data: mockBinaryData });

      await notesManager.deleteOldNotes(passId);

      expect(mockDataClient.deleteBinaryDataByIds).not.toHaveBeenCalled();
    });

    it('should not delete anything if no notes exist for the pass', async () => {
      // Mock binaryDataByFilter to return an empty array for a different pass
      const otherPassNote = { pass_id: 'other-pass', note_text: 'note for another pass', created_at: new Date().toISOString(), created_by: 'test' };
      const mockBinaryData = [
        { metadata: { binaryDataId: 'id-other' }, binary: new TextEncoder().encode(JSON.stringify(otherPassNote)) },
      ];
      mockDataClient.binaryDataByFilter.mockResolvedValue({ data: mockBinaryData });

      await notesManager.deleteOldNotes(passId);

      expect(mockDataClient.deleteBinaryDataByIds).not.toHaveBeenCalled();
    });
  });
});