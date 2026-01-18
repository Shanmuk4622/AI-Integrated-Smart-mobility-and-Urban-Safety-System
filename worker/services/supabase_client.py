import os
import time
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env variables from worker root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

class SupabaseService:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
            
        self.supabase: Client = create_client(url, key)
        print("DEBUG: Supabase Client Initialized")

    def get_junction_config(self, junction_id: int):
        """Fetches junction details to ensure it exists and gets video source if needed."""
        try:
            response = self.supabase.table("junctions").select("*").eq("id", junction_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            print(f"ERROR: Failed to fetch junction config: {e}")
            return None

    def log_traffic_data(self, junction_id: int, vehicle_count: int, congestion_level: str, avg_speed: float = 0.0):
        """Inserts a row into traffic_logs."""
        data = {
            "junction_id": junction_id,
            "vehicle_count": vehicle_count,
            "congestion_level": congestion_level,
            "avg_speed": avg_speed
        }
        try:
            self.supabase.table("traffic_logs").insert(data).execute()
        except Exception as e:
            print(f"ERROR: Failed to log traffic data: {e}")

    def log_violation(self, junction_id: int, violation_type: str, image_path: str = None):
        """
        Logs a violation. 
        """
        image_url = None 
        
        data = {
            "junction_id": junction_id,
            "violation_type": violation_type,
            "image_url": image_url
        }
        try:
            self.supabase.table("violations").insert(data).execute()
            print(f"DEBUG: Logged VIOLATION [{violation_type}] for Junction {junction_id}")
        except Exception as e:
            print(f"ERROR: Failed to log violation: {e}")

    def update_junction_info(self, junction_id: int, name: str, latitude: float, longitude: float):
        """Updates the junction's static info (name, lat, long) on startup."""
        try:
            # Check if exists first
            res = self.supabase.table("junctions").select("id").eq("id", junction_id).execute()
            
            data = {
                "name": name,
                "latitude": latitude,
                "longitude": longitude,
                "status": "active"
            }
            
            print(f"DEBUG: Attempting to update Junction {junction_id} with data: {data}")
            
            if res.data:
                # Update
                update_response = self.supabase.table("junctions").update(data).eq("id", junction_id).execute()
                print(f"DEBUG: Update response: {update_response}")
                print(f"DEBUG: Updated Junction {junction_id} info: {name} @ {latitude}, {longitude}")
            else:
                # Insert (Optional, if we want auto-registration)
                data["id"] = junction_id
                data["video_source"] = "auto-registered" # Placeholder
                insert_response = self.supabase.table("junctions").insert(data).execute()
                print(f"DEBUG: Insert response: {insert_response}")
                print(f"DEBUG: Registered New Junction {junction_id}")
                
        except Exception as e:
            print(f"ERROR: Failed to update junction info: {e}")
            import traceback
            traceback.print_exc()

    def update_status(self, junction_id: int, status: str):
        """Updates the junction status (active/offline)."""
        try:
            self.supabase.table("junctions").update({"status": status}).eq("id", junction_id).execute()
            print(f"DEBUG: Junction {junction_id} status set to: {status}")
        except Exception as e:
             print(f"ERROR: Failed to update status: {e}")
