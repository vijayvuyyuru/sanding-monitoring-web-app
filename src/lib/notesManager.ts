import * as VIAM from "@viamrobotics/sdk";

export interface PassNote {
  pass_id: string;
  note_text: string;
  created_at: string;
  created_by: string;
}

export class NotesManager {
  private viamClient: VIAM.ViamClient;
  private machineId: string;
  private cachedNotes: Map<string, PassNote> | null = null;

  constructor(viamClient: VIAM.ViamClient, machineId: string) {
    this.viamClient = viamClient;
    this.machineId = machineId;
  }

  /**
   * Get all notes from metadata - stored as flat key-value pairs
   * Each note is stored as: "note-{passId}": "json-stringified-PassNote"
   */
  private async getNotesMetadata(): Promise<Map<string, PassNote>> {
    if (this.cachedNotes !== null) {
      return this.cachedNotes;
    }

    const metadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);
    const notes = new Map<string, PassNote>();

    const PREFIX = 'note-';
    Object.keys(metadata).forEach(key => {
      if (key.startsWith(PREFIX)) {
        const passId = key.substring(PREFIX.length);
        try {
          const noteData = JSON.parse(metadata[key] as string);
          notes.set(passId, noteData as PassNote);
        } catch (e) {
          console.warn(`Failed to parse note for pass ${passId}:`, e);
        }
      }
    });

    this.cachedNotes = notes;

    // Log all loaded notes
    console.log(`📝 Loaded ${notes.size} notes from metadata:`);
    if (notes.size > 0) {
      console.table(Array.from(notes.entries()).map(([passId, note]) => ({
        passId,
        noteText: note.note_text.substring(0, 50) + (note.note_text.length > 50 ? '...' : ''),
        createdAt: note.created_at,
        createdBy: note.created_by
      })));
    }

    return notes;
  }

  /**
   * Save all notes to metadata as flat key-value pairs
   * IMPORTANT: Merges with existing metadata to preserve other apps' data
   */
  private async saveNotesMetadata(notes: Map<string, PassNote>): Promise<void> {
    // Read current metadata to preserve non-note keys
    const currentMetadata = await this.viamClient.appClient.getRobotMetadata(this.machineId);

    // Remove old note keys (cleanup any deleted notes)
    const PREFIX = 'note-';
    Object.keys(currentMetadata).forEach(key => {
      if (key.startsWith(PREFIX)) {
        delete currentMetadata[key];
      }
    });

    // Add all current notes
    notes.forEach((note, passId) => {
      currentMetadata[`note-${passId}`] = JSON.stringify(note);
    });

    // Save merged metadata (preserves other apps' keys)
    await this.viamClient.appClient.updateRobotMetadata(this.machineId, currentMetadata);

    // Update cache
    this.cachedNotes = notes;

    // Log all notes after save
    console.log(`💾 Saved ${notes.size} notes to metadata:`);
    if (notes.size > 0) {
      console.table(Array.from(notes.entries()).map(([passId, note]) => ({
        passId,
        noteText: note.note_text.substring(0, 50) + (note.note_text.length > 50 ? '...' : ''),
        createdAt: note.created_at,
        createdBy: note.created_by
      })));
    }
  }

  /**
   * Save a note for a specific pass (replaces any existing note)
   */
  async savePassNote(passId: string, noteText: string): Promise<void> {
    console.log(`Saving note for pass ${passId}`);

    const notes = await this.getNotesMetadata();

    const now = new Date();
    const note: PassNote = {
      pass_id: passId,
      note_text: noteText,
      created_at: now.toISOString(),
      created_by: "summary-web-app"
    };

    notes.set(passId, note);

    await this.saveNotesMetadata(notes);

    console.log("Note saved successfully!");
  }

  /**
   * Delete a note for a specific pass
   */
  async deleteAllNotesForPass(passId: string): Promise<void> {
    console.log(`Deleting note for pass ${passId}`);

    const notes = await this.getNotesMetadata();

    if (notes.has(passId)) {
      notes.delete(passId);
      await this.saveNotesMetadata(notes);
      console.log("Note deleted successfully!");
    } else {
      console.log("No note found for this pass");
    }
  }

  /**
   * Fetch notes for multiple passes
   * @param passIds - An array of pass IDs to fetch notes for
   * @param onBatchReceived - Optional callback (kept for API compatibility but not used since we fetch all at once)
   * @returns A Promise that resolves to a map of all fetched notes
   */
  async fetchNotesForPasses(
    passIds: string[],
    onBatchReceived?: (batch: Map<string, PassNote[]>) => void
  ): Promise<Map<string, PassNote[]>> {
    console.log(`Fetching notes for ${passIds.length} passes`);

    const notes = await this.getNotesMetadata();
    const result = new Map<string, PassNote[]>();

    // Build result map - each pass has at most one note
    passIds.forEach(passId => {
      const note = notes.get(passId);
      if (note) {
        result.set(passId, [note]);
      }
    });

    // Call the callback if provided (for compatibility with existing code)
    if (onBatchReceived && result.size > 0) {
      onBatchReceived(result);
    }

    console.log(`Found notes for ${result.size} passes`);
    return result;
  }

  /**
   * Clear cache - useful after clearing metadata
   */
  clearCache(): void {
    this.cachedNotes = null;
  }
}

export function createNotesManager(viamClient: VIAM.ViamClient, machineId: string): NotesManager {
  return new NotesManager(viamClient, machineId);
}
