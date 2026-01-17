class TrafficController:
    def __init__(self):
        self.standard_green_duration = 30  # seconds
        self.min_green_duration = 10
        self.max_green_duration = 60
        self.ambulance_priority_active = False

    def calculate_signal_duration(self, lane_density: int, ambulance_detected: bool) -> dict:
        """
        Rule-based logic for signal control.
        
        Args:
            lane_density: Number of vehicles in the lane.
            ambulance_detected: Boolean, true if an ambulance is in the lane.
            
        Returns:
            dict: {"action": "GREEN" | "RED", "duration": int}
        """
        
        # Rule 1: Emergency Priority
        if ambulance_detected:
            self.ambulance_priority_active = True
            return {
                "action": "GREEN",
                "duration": 60,
                "reason": "Ambulance Detected - Green Corridor Active"
            }
        
        # Rule 2: High Density handling
        if lane_density > 15:  # Arbitrary threshold for "heavy traffic"
            # Increase green time
            duration = min(self.max_green_duration, self.standard_green_duration + (lane_density * 2))
            return {
                "action": "GREEN",
                "duration": duration,
                "reason": f"High Density ({lane_density}) - Extending Green"
            }
            
        # Rule 3: Low Density
        if lane_density < 5:
            return {
                "action": "GREEN",
                "duration": self.min_green_duration,
                "reason": "Low Density - Minimal Green"
            }
            
        # Default
        return {
            "action": "GREEN",
            "duration": self.standard_green_duration,
            "reason": "Normal Flow"
        }
