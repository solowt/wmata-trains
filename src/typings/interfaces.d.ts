export interface SelectedTrain {
	id: string;
	intervalId: number;
	secondsSinceMoved: number;
	lastCircuit: number;
}
export interface LineWidgets {
	RD: StationTracker;
	OR: StationTracker;
	YL: StationTracker;
	GR: StationTracker;
	BL: StationTracker;
	SV: StationTracker;
	YLRP: StationTracker;
}
export interface TrackCount {
	track1: number;
	track2: number;
}
export interface TrainAlert {
	id: string;
}
export interface StationAlert {
	direction: number;
	lines: string[];
	station: string;
}