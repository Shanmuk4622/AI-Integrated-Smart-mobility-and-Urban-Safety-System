export interface SignalStatus {
    action: "GREEN" | "RED";
    duration: number;
    reason: string;
}

export interface StreamStats {
    density: number;
    signal: SignalStatus;
    ambulance: boolean;
}
