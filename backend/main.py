from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import sys
import os
import json
import asyncio

# Add project root to path if needed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.ai_pipeline import SmartMobilitySystem

app = FastAPI(title="Smart Mobility System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths to models (assuming running from backend folder)
# We need to go up one level to find the models in the other folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXTERNAL_DIR = os.path.join(BASE_DIR, "Automatic-License-Plate-Recognition-using-YOLOv8")
VIDEO_PATH = os.path.join(EXTERNAL_DIR, "Videos", "sample2.mp4")
COCO_MODEL = os.path.join(EXTERNAL_DIR, "yolov8n.pt")
LP_MODEL = os.path.join(EXTERNAL_DIR, "license_plate_detector.pt")

print(f"Loading models from: {EXTERNAL_DIR}")

@app.get("/")
def read_root():
    return {"status": "System Operational", "module": "Smart Mobility Nexus"}

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket Connected")
    
    # Initialize System for this connection (or use a singleton in production)
    system = SmartMobilitySystem(
        video_path=VIDEO_PATH,
        coco_model_path=COCO_MODEL,
        lp_model_path=LP_MODEL
    )
    
    try:
        # Loop through frames
        for frame_bytes, stats in system.process_stream():
            # Send Data
            # We can send frame as binary or base64. 
            # For simplicity in prototype, we'll send bytes (binary) and stats separate?
            # Or better: Send JSON with base64 image (less efficient but easier for simple React canvas)
            # OR: Send bytes and stats separate.
            
            # Let's send text frame first with stats, then binary frame? 
            # WebSocket handling binary + text can be tricky in simple clients.
            # Strategy: Send JSON containing stats, client requests frame? No, too slow.
            # Strategy: Send JSON with Stats. Client assumes next binary message is frame.
            
            await websocket.send_json(stats)
            await websocket.send_bytes(frame_bytes)
            
            # Control framerate slightly to not overwhelm
            await asyncio.sleep(0.05) 
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error in stream: {e}")
        await websocket.close()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
