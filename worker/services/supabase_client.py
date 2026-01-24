import os
import time
import cv2
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

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
        DEPRECATED: Use log_violation_enhanced instead
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

    def log_violation_enhanced(self, junction_id: int, violation_type: str, 
                              confidence_score: float, vehicle_speed: float = None,
                              license_plate: str = None, image_url: str = None):
        """
        Enhanced violation logging with all details for admin panel
        Returns violation_id for image upload
        """
        data = {
            "junction_id": junction_id,
            "violation_type": violation_type,
            "confidence_score": confidence_score,
            "vehicle_speed": vehicle_speed,
            "image_url": image_url,
            "status": "pending"  # For admin review
        }
        
        try:
            response = self.supabase.table("violations").insert(data).execute()
            violation_id = response.data[0]['id'] if response.data else None
            
            if violation_id:
                print(f"DEBUG: Logged VIOLATION [{violation_type}] ID={violation_id} confidence={confidence_score:.2f} speed={vehicle_speed}")
            
            return violation_id
        except Exception as e:
            print(f"ERROR: Failed to log violation: {e}")
            import traceback
            traceback.print_exc()
            return None

    def upload_violation_image(self, image_array, junction_id: int, violation_id: int):
        """
        Upload violation image to Supabase Storage
        Returns public URL of uploaded image
        """
        try:
            # Convert to JPEG bytes
            _, buffer = cv2.imencode('.jpg', image_array, [cv2.IMWRITE_JPEG_QUALITY, 85])
            image_bytes = buffer.tobytes()
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"junction_{junction_id}/{timestamp}_{violation_id}.jpg"
            
            # Upload to Supabase Storage
            response = self.supabase.storage.from_('violations').upload(
                filename,
                image_bytes,
                file_options={"content-type": "image/jpeg"}
            )
            
            # Get public URL
            public_url = self.supabase.storage.from_('violations').get_public_url(filename)
            
            # Update violation record with image URL
            self.supabase.table("violations")\
                .update({"image_url": public_url})\
                .eq("id", violation_id)\
                .execute()
            
            print(f"DEBUG: Uploaded violation image: {filename}")
            return public_url
            
        except Exception as e:
            print(f"ERROR: Failed to upload image: {e}")
            import traceback
            traceback.print_exc()
            return None

    def log_emergency_vehicle(self, junction_id: int, vehicle_type: str = 'ambulance',
                              direction: str = 'unknown', estimated_speed: float = None):
        """
        Log emergency vehicle detection
        Returns emergency_vehicle_id
        """
        data = {
            "junction_id": junction_id,
            "vehicle_type": vehicle_type,
            "direction": direction,
            "estimated_speed": estimated_speed,
            "detected_at": datetime.now().isoformat(),
            "last_seen_at": datetime.now().isoformat(),
            "status": "active",
            "priority_level": 1
        }
        
        try:
            response = self.supabase.table("emergency_vehicles").insert(data).execute()
            emergency_id = response.data[0]['id'] if response.data else None
            
            if emergency_id:
                print(f"🚨 EMERGENCY: {vehicle_type} detected at Junction {junction_id} (ID={emergency_id})")
            
            return emergency_id
        except Exception as e:
            print(f"ERROR: Failed to log emergency vehicle: {e}")
            return None

    def update_emergency_vehicle_last_seen(self, emergency_id: int):
        """Update last seen timestamp for active active emergency vehicle"""
        try:
            self.supabase.table("emergency_vehicles")\
                .update({"last_seen_at": datetime.now().isoformat()})\
                .eq("id", emergency_id)\
                .execute()
        except Exception as e:
            print(f"ERROR: Failed to update emergency vehicle: {e}")

    def log_worker_health(self, junction_id: int, fps: float, cpu_usage: float = None,
                         memory_usage: float = None, avg_detection_confidence: float = None,
                         total_detections: int = 0, status: str = 'running'):
        """
        Log worker performance metrics for system monitoring
        """
        data = {
            "junction_id": junction_id,
            "fps": fps,
            "cpu_usage": cpu_usage,
            "memory_usage": memory_usage,
            "avg_detection_confidence": avg_detection_confidence,
            "avg_detection_confidence": avg_detection_confidence,
            "total_detections": total_detections,
            "status": status,
            "last_heartbeat": datetime.now().isoformat()
        }
        
        try:
            self.supabase.table("worker_health").insert(data).execute()
            # Only print occasionally to avoid spam
            if total_detections % 100 == 0:
                print(f"DEBUG: Worker health logged - FPS: {fps:.1f}, CPU: {cpu_usage:.1f}%, Detections: {total_detections}")
        except Exception as e:
            print(f"ERROR: Failed to log worker health: {e}")

    def update_junction_info(self, junction_id: int, name: str, latitude: float, longitude: float, video_source: str = None, fps: int = 30, ppm: int = 50):
        """Updates the junction's static info (name, lat, long) on startup."""
        try:
            # Check if exists first
            res = self.supabase.table("junctions").select("id").eq("id", junction_id).execute()
            
            data = {
                "name": name,
                "latitude": latitude,
                "longitude": longitude,
                "video_source": video_source,
                "fps": int(fps),
                "ppm": int(ppm),
                "status": "active"
            }
            
            print(f"DEBUG: Attempting to update Junction {junction_id} with data: {data}")
            
            if res.data:
                # Update
                update_response = self.supabase.table("junctions").update(data).eq("id", junction_id).execute()
                print(f"DEBUG: Update response: {update_response}")
                print(f"DEBUG: Updated Junction {junction_id} info: {name} @ {latitude}, {longitude}")
            else:
                # Insert (Optional, if we want auto-registered)
                data["id"] = junction_id
                # video_source is already in data
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

    def upload_frame_snapshot(self, frame, junction_id: int):
        """
        Uploads a frame snapshot to 'junction-frames' bucket.
        Returns the public URL.
        """
        try:
            # Resize for bandwidth optimization (e.g. 640x360)
            h, w = frame.shape[:2]
            scale = min(640/w, 360/h)
            if scale < 1:
                frame = cv2.resize(frame, (0,0), fx=scale, fy=scale)
            
            # Encode to JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
            image_bytes = buffer.tobytes()
            
            # Timestamp filename
            timestamp = int(time.time())
            filename = f"junction_{junction_id}/{timestamp}.jpg"
            
            # Upload
            res = self.supabase.storage.from_("junction-frames").upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
            
            # Get Public URL
            public_url = self.supabase.storage.from_("junction-frames").get_public_url(filename)
            
            # Broadcast the new frame URL via Realtime
            self.broadcast_frame_update(junction_id, public_url)
            
            return public_url
            
        except Exception as e:
            # print(f"ERROR: Snapshot upload failed: {e}") # Suppress to avoid spam
            return None

    def broadcast_frame_update(self, junction_id: int, image_url: str):
        """
        Broadcasts the new frame URL to the 'junction_live_feed' channel.
        """
        try:
            payload = {
                "junction_id": junction_id,
                "image_url": image_url,
                "timestamp": datetime.now().isoformat()
            }
            # We can't directly broadcast via python client easily without being admin or using a workaround.
            # Workaround: Update a 'live_feeds' table or just rely on the dashboard pulling it?
            # Better: The Dashboard can subscribe to Postgres Changes on a table.
            # Let's use `junctions` table update "video_source" field? No that's configuration.
            # Let's insert into a ephemeral table? No, too much DB write.
            # ACTUALLY: Supabase Realtime Broadcast is supported via client.channel().send().
            # But the python client support for broadcast send might be limited.
            
            # Alternative: Just update `last_heartbeat` in `worker_health` with metadata?
            # Let's insert to `worker_health` often? No.
            
            # Best low-overhead way: Update a dedicated column `live_snapshot_url` in `junctions` table?
            # Yes, that's persistent but acceptable for 1 update/sec.
            self.supabase.table("junctions").update({"live_snapshot_url": image_url}).eq("id", junction_id).execute()
            
        except Exception as e:
            pass

    def cleanup_old_snapshots(self, junction_id: int, max_age_seconds: int = 600):
        """
        Deletes snapshots older than max_age_seconds.
        """
        try:
            # List files
            folder = f"junction_{junction_id}"
            files = self.supabase.storage.from_("junction-frames").list(folder)
            
            now = time.time()
            to_remove = []
            
            for f in files:
                # Name is timestamp.jpg
                try:
                    name = f['name']
                    ts = int(name.split('.')[0])
                    if now - ts > max_age_seconds:
                        to_remove.append(f"{folder}/{name}")
                except:
                    pass
            
            if to_remove:
                self.supabase.storage.from_("junction-frames").remove(to_remove)
                print(f"DEBUG: Cleaned up {len(to_remove)} old snapshots for Junction {junction_id}")
                
        except Exception as e:
            print(f"ERROR: Cleanup failed: {e}")

    def cleanup_old_violations(self, junction_id: int, max_age_seconds: int = 86400):
        """
        Deletes violation images older than max_age_seconds (default 1 day).
        This assumes violation images are stored in 'violations' bucket with a timestamp in the name.
        """
        try:
            # List files
            folder = f"junction_{junction_id}"
            files = self.supabase.storage.from_("violations").list(folder)
            
            now = time.time()
            to_remove = []
            
            for f in files:
                try:
                    name = f['name']
                    # Name format: YYYYMMDD_HHMMSS_ID.jpg
                    # Parse timestamp from name
                    date_part = name.split('_')[0] + name.split('_')[1] # YYYYMMDDHHMMSS
                    # Convert to unix timestamp
                    dt = datetime.strptime(date_part, "%Y%m%d%H%M%S")
                    ts = dt.timestamp()
                    
                    if now - ts > max_age_seconds:
                        to_remove.append(f"{folder}/{name}")
                except Exception:
                    # If format doesn't match or other error, skip
                    pass
            
            if to_remove:
                self.supabase.storage.from_("violations").remove(to_remove)
                print(f"DEBUG: Cleaned up {len(to_remove)} old violation images for Junction {junction_id}")
                
        except Exception as e:
            # Bucket might not exist or other error, suppress to avoid log spam if empty
            # print(f"ERROR: Violation cleanup failed: {e}")
            pass
