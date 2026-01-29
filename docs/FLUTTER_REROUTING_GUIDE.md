# 📱 Flutter Integration Guide: Smart Rerouting

This guide provides step-by-step instructions to implement the **Smart Rerouting** feature in your existing Flutter application.

**Goal**: Detect when a user's current route passes through a congested junction and trigger a reroute.

---

## 📦 1. Dependencies

Add these packages to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Connect to our backend
  supabase_flutter: ^2.0.0
  
  # Maps & Location
  google_maps_flutter: ^2.5.0
  geolocator: ^10.1.0
  
  # Geometry math (for distance/polyline checks)
  vector_math: ^2.1.4
```

Run:
```bash
flutter pub get
```

---

## ⚡ 2. Supabase Setup

Initialize Supabase in your `main.dart`. Use the same URL and Key from your web project.

```dart
// main.dart
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
  );
  
  runApp(MyApp());
}

// Global client accessor
final supabase = Supabase.instance.client;
```

---

## 🧠 3. Traffic Logic Service

Create a file `lib/services/traffic_service.dart`. This service will listen for real-time congestion updates.

```dart
import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class Junction {
  final int id;
  final LatLng position;
  final String status;
  String congestionLevel; // 'Low', 'Medium', 'High'

  Junction({
    required this.id,
    required this.position,
    required this.status,
    this.congestionLevel = 'Low',
  });

  // Factory to parse from DB
  factory Junction.fromMap(Map<String, dynamic> map) {
    // Assuming location is "lat,lng" string in DB
    final coords = (map['location'] as String).split(',');
    return Junction(
      id: map['id'],
      position: LatLng(double.parse(coords[0]), double.parse(coords[1])),
      status: map['status'] ?? 'active',
    );
  }
}

class TrafficService {
  final _supabase = Supabase.instance.client;
  
  List<Junction> junctions = [];
  
  // Stream controller to notify UI of congestion changes
  final _congestionController = StreamController<List<Junction>>.broadcast();
  Stream<List<Junction>> get congestionStream => _congestionController.stream;

  // 1. Fetch Initial Junctions
  Future<void> fetchJunctions() async {
    final response = await _supabase.from('junctions').select();
    junctions = (response as List).map((e) => Junction.fromMap(e)).toList();
    _congestionController.add(junctions);
  }

  // 2. Subscribe to Realtime Updates
  void subscribeToTraffic() {
    _supabase
        .channel('public:traffic_logs')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'traffic_logs',
          callback: (payload) {
            final newLog = payload.newRecord;
            final junctionId = newLog['junction_id'];
            final level = newLog['congestion_level'];

            // Update local state
            final index = junctions.indexWhere((j) => j.id == junctionId);
            if (index != -1) {
              junctions[index].congestionLevel = level;
              
              // Only notify if HIGH congestion (which triggers reroute)
              _congestionController.add(junctions);
              
              if (level == 'High') {
                print("⚠️ Alert: High Congestion at Junction $junctionId");
              }
            }
          },
        )
        .subscribe();
  }

  // 3. The Core Reroute Logic
  // Check if ANY point in the current polyline is close to a High Congestion junction
  bool shouldReroute(List<LatLng> routePoints) {
    const double detectionRadiusMeters = 500; // 500m radius

    for (var junction in junctions) {
      if (junction.congestionLevel != 'High') continue;

      for (var point in routePoints) {
        // Simple distance check (using geolocator or manual haversine)
        // Here uses a helper (implementation below)
        double dist = _calculateDistance(point, junction.position);
        
        if (dist < detectionRadiusMeters) {
          return true; // Reroute needed!
        }
      }
    }
    return false;
  }
  
  // Helper: Haversine distance in meters
  // (Or use geolocator package: Geolocator.distanceBetween)
  double _calculateDistance(LatLng p1, LatLng p2) {
    // ... implementation ...
    // For now, assume Geolocator is used:
    // return Geolocator.distanceBetween(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    return 0.0; // Placeholder
  }
}
```

---

## 🗺️ 4. Integration in Map Screen

In your Google Maps Widget:

```dart
class MapScreen extends StatefulWidget {
  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final TrafficService _trafficService = TrafficService();
  List<LatLng> currentRoutePolyline = []; // Your current route
  
  @override
  void initState() {
    super.initState();
    _initTraffic();
  }

  void _initTraffic() async {
    await _trafficService.fetchJunctions();
    _trafficService.subscribeToTraffic();
    
    // Listen for updates
    _trafficService.congestionStream.listen((junctions) {
       // Whenever traffic updates, check our route
       if (_trafficService.shouldReroute(currentRoutePolyline)) {
         _triggerReroute();
       }
    });
  }

  void _triggerReroute() {
    // Show UI Alert
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text("⚠️ High Traffic Detected! Rerouting..."),
        backgroundColor: Colors.redAccent,
        duration: Duration(seconds: 3),
      )
    );

    // Call your Directions API again
    // IMPORTANT: Adding avoidHighways or waypoints might not be enough.
    // You typically need to request alternatives OR add the congested junction 
    // as an 'avoid' area if the API supports it, or simply request a new route 
    // and hope the Directions API sees the traffic (Google usually does).
    
    // If using Google Routes API, you can set `traffic_model: best_guess`.
    
    _fetchDirections(forceRefresh: true);
  }
  
  // Your existing direction fetcher
  void _fetchDirections({bool forceRefresh = false}) {
    // ...
  }
}
```

## ✅ Summary
1.  **Connect** Flutter to Supabase.
2.  **Listen** to `traffic_logs` INSERT events.
3.  **Cross-reference** the "High" congestion updates with your current route path.
4.  **Trigger** a standard Google Maps Directions API call again if a conflict is found.
