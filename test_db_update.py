"""
Quick test to verify if junction data is actually updating in Supabase
"""
import os
import sys
sys.path.insert(0, 'worker')

from worker.services.supabase_client import SupabaseService

# Initialize Supabase
db = SupabaseService()

# Fetch Junction 1
print("Fetching Junction 1 from database...")
response = db.supabase.table("junctions").select("*").eq("id", 1).execute()

if response.data:
    junction = response.data[0]
    print("\n=== Junction 1 Data ===")
    print(f"ID: {junction.get('id')}")
    print(f"Name: {junction.get('name')}")
    print(f"Location (old): {junction.get('location')}")
    print(f"Latitude: {junction.get('latitude')}")
    print(f"Longitude: {junction.get('longitude')}")
    print(f"Status: {junction.get('status')}")
    print(f"Video Source: {junction.get('video_source')}")
    
    # Check if coordinates match config
    from config import LATITUDE, LONGITUDE, LOCATION_NAME
    
    print("\n=== Expected from config.py ===")
    print(f"Name: {LOCATION_NAME}")
    print(f"Latitude: {LATITUDE}")
    print(f"Longitude: {LONGITUDE}")
    
    print("\n=== Comparison ===")
    if junction.get('latitude') == LATITUDE and junction.get('longitude') == LONGITUDE:
        print("✅ Coordinates MATCH! Update is working!")
    else:
        print("❌ Coordinates DO NOT MATCH. Update failed.")
        print(f"   DB has: {junction.get('latitude')}, {junction.get('longitude')}")
        print(f"   Config has: {LATITUDE}, {LONGITUDE}")
else:
    print("❌ Junction 1 not found in database!")
