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

  constructor(viamClient: VIAM.ViamClient, machineId: string) {
    this.viamClient = viamClient;
    this.machineId = machineId;
  }

  /**
   * Save a note for a specific pass
   */
  async savePassNote(passId: string, noteText: string, partId: string): Promise<PassNote> {
    if (!this.viamClient) {
      throw new Error("Viam client not initialized");
    }

    const now = new Date();
    console.log(`Saving note for pass ${passId}: "${noteText}"`);

    if (!partId) {
      throw new Error("No part ID available for upload");
    }

    // Create a JSON note object
    const noteData: PassNote = {
      pass_id: passId,
      note_text: noteText,
      created_at: now.toISOString(),
      created_by: "web-app"
    };

    // Convert to binary data (JSON string as bytes)
    const noteJson = JSON.stringify(noteData);
    const binaryData = new TextEncoder().encode(noteJson);

    try {
      // Upload the new note with pass_id in tags for easier filtering
      await this.viamClient.dataClient.binaryDataCaptureUpload(
        binaryData,
        partId,
        "rdk:component:generic",
        "sanding-notes",
        "SaveNote",
        ".json",
        [now, now],
        ["sanding-notes", `pass:${passId}`] // Add pass ID as a tag
      );

      console.log("Note saved successfully!");

      // Run cleanup asynchronously - don't wait for it
      this.deleteOldNotes(passId)
        .then(() => console.log("Background cleanup completed"))
        .catch(error => console.warn("Background cleanup failed:", error));

      // Return immediately so UI can update
      return noteData;
    } catch (error) {
      console.error("Failed to save note:", error);
      throw error;
    }
  }

  /**
   * Delete old notes for a pass, keeping only the most recent one
   */
  async deleteOldNotes(passId: string): Promise<void> {
    try {
      const filter = {
        robotId: this.machineId,
        componentName: "sanding-notes",
        componentType: "rdk:component:generic",
        tags: ["sanding-notes"]
      } as unknown as VIAM.dataApi.Filter;

      const binaryData = await this.viamClient.dataClient.binaryDataByFilter(
        filter,
        20, // Limit - we only need recent notes
        VIAM.dataApi.Order.DESCENDING,
        undefined,
        false,
        false,
        true // Include binary data!
      );

      // Collect notes for this pass
      const notesForPass: Array<{
        note: PassNote,
        binaryId: string,
        createdAt: Date
      }> = [];

      for (const item of binaryData.data) {
        if (!item.metadata?.binaryDataId || !item.binary) continue;

        try {
          const noteJson = new TextDecoder().decode(item.binary);
          const noteData = JSON.parse(noteJson) as PassNote;

          if (noteData.pass_id === passId) {
            notesForPass.push({
              note: noteData,
              binaryId: item.metadata.binaryDataId,
              createdAt: new Date(noteData.created_at)
            });
          }
        } catch (error) {
          console.warn("Failed to process note:", error);
        }
      }

      // Delete old notes if more than 1
      if (notesForPass.length > 1) {
        notesForPass.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const idsToDelete = notesForPass.slice(1).map(item => item.binaryId);

        console.log(`Cleaning up ${idsToDelete.length} old notes for pass ${passId}`);

        if (idsToDelete.length > 0) {
          await this.viamClient.dataClient.deleteBinaryDataByIds(idsToDelete);
        }
      }
    } catch (error) {
      console.error("Failed to clean up old notes:", error);
    }
  }

  /**
   * Fetch all notes for a specific pass
   */
  async fetchPassNotes(passId: string): Promise<PassNote[]> {
    if (!this.viamClient) {
      throw new Error("Viam client not initialized");
    }

    console.log(`Fetching notes for pass ${passId}`);
    const startTime = Date.now();

    const filter = {
      robotId: this.machineId,
      componentName: "sanding-notes",
      componentType: "rdk:component:generic",
      tags: [`pass:${passId}`] // Use the specific tag for faster filtering
    } as unknown as VIAM.dataApi.Filter;

    const binaryData = await this.viamClient.dataClient.binaryDataByFilter(
      filter,
      20,
      VIAM.dataApi.Order.DESCENDING,
      undefined,
      false,
      false,
      true // Keep this to include binary data in one call
    );

    // The rest of the function can be simplified as you no longer need to filter by pass_id in the loop
    const passNotes: PassNote[] = binaryData.data.map(item => {
      const noteJson = new TextDecoder().decode(item.binary!);
      return JSON.parse(noteJson) as PassNote;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    console.log(`Retrieved ${passNotes.length} notes in ${Date.now() - startTime}ms`);
    return passNotes;
  }

  /**
   * Update an existing note (creates a new version)
   */
  async updatePassNote(passId: string, noteText: string, partId: string): Promise<void> {
    // For now, just create a new note - in the future we could add versioning
    await this.savePassNote(passId, noteText, partId);
  }
}

/**
 * Helper function to create a NotesManager instance
 */
export function createNotesManager(viamClient: VIAM.ViamClient, machineId: string): NotesManager {
  return new NotesManager(viamClient, machineId);
}