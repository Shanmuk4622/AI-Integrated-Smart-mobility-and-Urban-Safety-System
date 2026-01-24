import os
import requests
from dotenv import load_dotenv

# Load env variables
load_dotenv('.env')

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") # Service Role Key preferred for admin tasks

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    exit(1)

def create_bucket(bucket_name, public=True):
    """
    Creates a storage bucket using Supabase REST API (since python-client might not expose bucket admin).
    """
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY
    }
    
    url = f"{SUPABASE_URL}/storage/v1/bucket"
    data = {
        "id": bucket_name,
        "name": bucket_name,
        "public": public,
        "file_size_limit": 5242880, # 5MB limit per file
        "allowed_mime_types": ["image/jpeg", "image/png"]
    }
    
    print(f"Creating bucket '{bucket_name}'...")
    try:
        res = requests.post(url, json=data, headers=headers)
        if res.status_code == 200:
            print(f"✅ Bucket '{bucket_name}' created successfully.")
        elif res.status_code == 400 and "already exists" in res.text:
            print(f"ℹ️ Bucket '{bucket_name}' already exists.")
        else:
            print(f"❌ Failed to create bucket: {res.status_code} {res.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("------- Supabase Storage Setup -------")
    create_bucket("junction-frames", public=True)
    print("--------------------------------------")
