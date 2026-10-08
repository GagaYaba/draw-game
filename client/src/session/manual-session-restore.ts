export interface ManualSessionRestoreGate {
  begin(): boolean;
  finish(): void;
  isInFlight(): boolean;
}

export function createManualSessionRestoreGate(): ManualSessionRestoreGate {
  let inFlight = false;

  return {
    begin() {
      if (inFlight) {
        return false;
      }

      inFlight = true;
      return true;
    },
    finish() {
      inFlight = false;
    },
    isInFlight() {
      return inFlight;
    },
  };
}
