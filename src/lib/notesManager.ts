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
  async savePassNote(passId: string, noteText: string, partId: string): Promise<void> {
    if (!this.viamClient) {
      throw new Error("Viam client not initialized");
    }

    const now = new Date();
    console.log(`Saving note for pass ${passId}: "${noteText}"`);

    if (!partId) {
      throw new Error("No part ID available for upload");
    }

    const noteData: PassNote = {
      pass_id: passId,
      note_text: noteText,
      created_at: now.toISOString(),
      created_by: "web-app"
    };

    const noteJson = JSON.stringify(noteData);
    const binaryData = new TextEncoder().encode(noteJson);

    await this.viamClient.dataClient.binaryDataCaptureUpload(
      binaryData,
      partId,
      "rdk:component:generic",
      "sanding-notes",
      "SaveNote",
      ".json",
      [now, now],
      ["sanding-notes"]
    );

    console.log("Note saved successfully!");
  }

  /**
   * Fetch notes for multiple passes, with optional batching.
   * @param passIds - An array of pass IDs to fetch notes for.
   * @param onBatchReceived - An optional callback that receives notes as they are fetched in batches.
   * @returns A Promise that resolves to a map of all fetched notes if no callback is provided.
   */
  async fetchNotesForPasses(
    passIds: string[],
    onBatchReceived?: (batch: Map<string, PassNote[]>) => void
  ): Promise<Map<string, PassNote[]>> {
    if (!this.viamClient) {
      throw new Error("Viam client not initialized");
    }

    const filter = {
      robotId: this.machineId,
      componentName: "sanding-notes",
      componentType: "rdk:component:generic",
      tags: ["sanding-notes"],
    } as unknown as VIAM.dataApi.Filter;

    const allNotesByPassId = new Map<string, PassNote[]>();
    passIds.forEach(passId => {
      allNotesByPassId.set(passId, []);
    });

    let paginationToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const binaryData = await this.viamClient.dataClient.binaryDataByFilter(
        filter,
        50, // Fetch in smaller batches
        VIAM.dataApi.Order.DESCENDING,
        paginationToken,
        false,
        false,
        false
      );

      const batchNotes = new Map<string, PassNote[]>();
      const promises = binaryData.data.map(async (item) => {
        try {
          const noteDataArray = await this.viamClient.dataClient.binaryDataByIds([item.metadata!.binaryDataId!]);
          if (noteDataArray.length > 0 && noteDataArray[0].binary) {
            const noteJson = new TextDecoder().decode(noteDataArray[0].binary);
            const noteData = JSON.parse(noteJson) as PassNote;

            if (passIds.includes(noteData.pass_id)) {
              if (!batchNotes.has(noteData.pass_id)) {
                batchNotes.set(noteData.pass_id, []);
              }
              batchNotes.get(noteData.pass_id)!.push(noteData);
            }
          }
        } catch (parseError) {
          console.warn("Failed to parse note data:", parseError);
        }
      });

      await Promise.all(promises);

      if (batchNotes.size > 0) {
        batchNotes.forEach((notes, passId) => {
          const existingNotes = allNotesByPassId.get(passId) || [];
          allNotesByPassId.set(passId, [...existingNotes, ...notes]);
        });

        if (onBatchReceived) {
          onBatchReceived(batchNotes);
        }
      }

      paginationToken = binaryData.last;
      hasMore = !!paginationToken;
    }

    allNotesByPassId.forEach((notes, passId) => {
      allNotesByPassId.set(
        passId,
        notes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    });

    return allNotesByPassId;
  }
}

/**
 * Helper function to create a NotesManager instance
 */
export function createNotesManager(viamClient: VIAM.ViamClient, machineId: string): NotesManager {
  return new NotesManager(viamClient, machineId);
}
