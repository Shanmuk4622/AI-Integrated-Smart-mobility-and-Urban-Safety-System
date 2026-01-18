import asyncio
import websockets
import json

async def test_connection():
    uri = "ws://localhost:8000/ws/stream"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting for data...")
            for i in range(5): # Get 5 frames
                msg_stats = await websocket.recv() # JSON stats
                msg_frame = await websocket.recv() # Binary frame
                
                stats = json.loads(msg_stats)
                print(f"\n--- Frame {i+1} Stats ---")
                print(f"Density: {stats.get('density')}")
                print(f"Signal: {stats.get('signal')}")
                print(f"Ambulance: {stats.get('ambulance')}")
                print(f"Violations: {stats.get('violations')}")
                print(f"Plates: {stats.get('plates')}")
                
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
