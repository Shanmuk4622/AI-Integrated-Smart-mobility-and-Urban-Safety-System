w:
        #     # Draw tracks (cyan) and LP boxes (red) for clarity
        #     for tr in track_ids:
        #         tx1, ty1, tx2, ty2, tid = tr
        #         cv2.rectangle(frame, (int(tx1), int(ty1)), (int(tx2), int(ty2)), (255, 255, 0), 2)
        #         cv2.putText(frame, f"ID:{int(tid)}", (int(tx1), max(0, int(ty1) - 8)),
        #                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        #     for lp in lp_det.boxes.data.tolist():
        #         x1, y1, x2, y2, lp_score, _ = lp
        #         cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
        #         cv2.putText(frame, f"LP:{lp_score:.2f}", (int(x1), max(0, int(y1) - 8)),
        #                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        #     cv2.imshow("ALPR", frame)
        #     if cv2.waitKey(1) & 0xFF == ord('q'):
        #         break