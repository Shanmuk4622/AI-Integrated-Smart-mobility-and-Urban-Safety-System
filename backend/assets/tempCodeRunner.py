from mainCombined2 import alpr_realtime

if __name__ == "__main__":
    alpr_realtime(
        video_path="Videos/sample2.mp4",
        coco_weights="yolov8n.pt",
        lp_weights="license_plate_detector.pt",
        vehicles=(2, 3, 5, 7),
        target_fps=10,          # adjust for performance
        smooth_window=5,        # moving average window
        show=True,              # show live window
        save_path="Videos/out.avi",
        codec="XVID"            # safer on Windows; use 'mp4v' for MP4
    )