import * as VIAM from "@viamrobotics/sdk";
import { Step } from "../AppInterface";

// Global polling state to handle multiple concurrent requests
interface PollingRequest {
  requestId: string;
  passId: string;
  stepName: string;
  startTime: number;
  onComplete: () => void;
}

export class VideoPollingManager {
  private static instance: VideoPollingManager;
  private activeRequests: Map<string, PollingRequest> = new Map();
  private isPolling: boolean = false;
  private pollInterval: number | null = null;
  private fetchDataFn: (() => Promise<void>) | null = null;
  private currentVideos: Map<string, VIAM.dataApi.BinaryData> = new Map();

  static getInstance(): VideoPollingManager {
    if (!VideoPollingManager.instance) {
      VideoPollingManager.instance = new VideoPollingManager();
    }
    return VideoPollingManager.instance;
  }

  setFetchData(fn: () => Promise<void>) {
    this.fetchDataFn = fn;
  }

  // Method to check if videos are available for a specific step
  checkVideoAvailability(step: Step): boolean {
    return Array.from(this.currentVideos.values()).some(file => {
      if (!file.metadata || !file.metadata.fileName) return false;
      const isMatchingStep = file.metadata.fileName.includes(step.pass_id) && 
                           file.metadata.fileName.includes(step.name);
      return isMatchingStep;
    });
  }

  // Method to update current videos for availability checking
  updateCurrentVideos(videos: Map<string, VIAM.dataApi.BinaryData>) {
    this.currentVideos = videos;
  }

  addRequest(step: Step, onComplete: () => void): string {
    const requestId = `${step.pass_id}-${step.name}`;
    
    if (this.activeRequests.has(requestId)) {
      // Request already exists, just update the callback
      const existing = this.activeRequests.get(requestId)!;
      existing.onComplete = onComplete;
      return requestId;
    }

    const request: PollingRequest = {
      requestId,
      passId: step.pass_id,
      stepName: step.name,
      startTime: Date.now(),
      onComplete
    };

    this.activeRequests.set(requestId, request);
    
    // Start polling if not already active
    if (!this.isPolling) {
      this.startPolling();
    }

    return requestId;
  }

  removeRequest(requestId: string) {
    this.activeRequests.delete(requestId);
    
    // Stop polling if no more requests
    if (this.activeRequests.size === 0) {
      this.stopPolling();
    }
  }

  private startPolling() {
    if (this.isPolling || !this.fetchDataFn) return;
    
    this.isPolling = true;
    const pollInterval = 5000; // Poll every 5 seconds
    
    this.pollInterval = setInterval(async () => {
      if (this.activeRequests.size === 0) {
        this.stopPolling();
        return;
      }

      try {
        // Single fetchData call for all active requests
        if (this.fetchDataFn) {
          await this.fetchDataFn();
        }
        
        // Check each request to see if videos are available
        const currentTime = Date.now();
        const maxPollingTime = 60000; // 60 seconds
        
        for (const [requestId, request] of this.activeRequests.entries()) {
          // Check timeout
          if (currentTime - request.startTime > maxPollingTime) {
            console.log(`Polling timeout reached for ${requestId}`);
            request.onComplete();
            this.activeRequests.delete(requestId);
            continue;
          }

          // Check if videos are available for this step
          const step: Step = {
            name: request.stepName,
            pass_id: request.passId,  
            start: new Date(),
            end: new Date()
          };
          
          if (this.checkVideoAvailability(step)) {
            console.log(`Videos found for ${requestId}, stopping polling for this request`);
            request.onComplete();
            this.activeRequests.delete(requestId);
            continue;
          }
        }

        // Stop polling if no more active requests
        if (this.activeRequests.size === 0) {
          this.stopPolling();
        }
      } catch (error) {
        console.error("Error during polling:", error);
        // Continue polling on error
      }
    }, pollInterval);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  // Method to check all active requests for video availability
  checkAllRequestsForVideos() {
    const completedRequests: string[] = [];
    console.log(`Checking ${this.activeRequests.size} active requests for video availability`);
    console.log(`Current videos count: ${this.currentVideos.size}`);
    
    for (const [requestId, request] of this.activeRequests.entries()) {
      const step: Step = {
        name: request.stepName,
        pass_id: request.passId,
        start: new Date(),
        end: new Date()
      };
      
      console.log(`Checking request ${requestId} for step ${request.stepName} with pass_id ${request.passId}`);
      
      if (this.checkVideoAvailability(step)) {
        console.log(`Videos found for ${requestId}, marking request as complete`);
        request.onComplete();
        completedRequests.push(requestId);
      } else {
        console.log(`No videos found yet for ${requestId}`);
      }
    }
    
    // Remove completed requests
    completedRequests.forEach(requestId => {
      this.activeRequests.delete(requestId);
    });
    
    console.log(`Completed ${completedRequests.length} requests, ${this.activeRequests.size} remaining`);
    
    // Stop polling if no more active requests
    if (this.activeRequests.size === 0) {
      console.log("No more active requests, stopping polling");
      this.stopPolling();
    }
    
    return completedRequests.length > 0;
  }

  // Method to force a check for videos (called after fetchData updates)
  forceVideoCheck() {
    if (this.activeRequests.size > 0) {
      console.log("Forcing video availability check after data update");
      this.checkAllRequestsForVideos();
    }
  }
}
