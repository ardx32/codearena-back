import base64
import cv2
import math
import numpy as np
import mediapipe as mp
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh

# Keep models alive globally to avoid re-initializing per request
face_detection = mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5)
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=2, min_detection_confidence=0.5)


def decode_base64_image(base64_string):
    try:
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        img_data = base64.b64decode(base64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def calculate_head_pose(landmarks, img_w, img_h):
    """
    Returns (roll_deg, yaw_deg) of the head.
    roll = head tilt (ear towards shoulder)
    yaw  = head turn (looking left/right)
    """
    nose_tip = landmarks[1]
    left_eye = landmarks[33]
    right_eye = landmarks[263]

    nose_px = (nose_tip.x * img_w, nose_tip.y * img_h)
    left_eye_px = (left_eye.x * img_w, left_eye.y * img_h)
    right_eye_px = (right_eye.x * img_w, right_eye.y * img_h)

    # Roll angle
    dy = right_eye_px[1] - left_eye_px[1]
    dx = right_eye_px[0] - left_eye_px[0]
    roll_deg = math.degrees(math.atan2(dy, dx))

    # Yaw angle
    eye_mid_x = (left_eye_px[0] + right_eye_px[0]) / 2
    eye_dist = abs(right_eye_px[0] - left_eye_px[0])

    if eye_dist > 0:
        nose_offset = (nose_px[0] - eye_mid_x) / eye_dist
        yaw_deg = nose_offset * 90
    else:
        yaw_deg = 0

    return roll_deg, yaw_deg


def analyze_frame(image):
    """Analyze a single frame. Returns dict with status, reason, message, angles."""
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img_h, img_w = image.shape[:2]

    # Check if camera is blocked (pitch black)
    mean_brightness = np.mean(image)
    if mean_brightness < 20:
        return {
            "status": "warning",
            "reason": "camera_blocked",
            "message": "Camera is blocked or covered. Please uncover your camera."
        }

    # Detect faces
    detection_results = face_detection.process(image_rgb)

    if not detection_results.detections:
        return {
            "status": "warning",
            "reason": "no_face",
            "message": "No face detected. Please look directly at the camera."
        }

    num_faces = len(detection_results.detections)
    if num_faces > 1:
        return {
            "status": "warning",
            "reason": "multiple_faces",
            "message": f"Multiple people detected ({num_faces}). Only the candidate is allowed."
        }

    # Head pose estimation via Face Mesh
    mesh_results = face_mesh.process(image_rgb)

    if not mesh_results.multi_face_landmarks:
        return {
            "status": "warning",
            "reason": "no_face",
            "message": "Could not track facial landmarks. Please face the camera directly."
        }

    face_landmarks = mesh_results.multi_face_landmarks[0].landmark
    roll_deg, yaw_deg = calculate_head_pose(face_landmarks, img_w, img_h)

    ROLL_THRESHOLD = 25
    YAW_THRESHOLD = 35

    if abs(roll_deg) > ROLL_THRESHOLD:
        direction = "left" if roll_deg > 0 else "right"
        return {
            "status": "warning",
            "reason": "head_tilted",
            "message": f"Head tilted too far to the {direction} ({abs(roll_deg):.0f}deg). Please sit upright.",
            "angles": {"roll": round(roll_deg, 1), "yaw": round(yaw_deg, 1)}
        }

    if abs(yaw_deg) > YAW_THRESHOLD:
        direction = "left" if yaw_deg < 0 else "right"
        return {
            "status": "warning",
            "reason": "looking_away",
            "message": f"Looking too far {direction} ({abs(yaw_deg):.0f}deg). Please face forward.",
            "angles": {"roll": round(roll_deg, 1), "yaw": round(yaw_deg, 1)}
        }

    return {
        "status": "success",
        "message": "Face verified.",
        "angles": {"roll": round(roll_deg, 1), "yaw": round(yaw_deg, 1)}
    }


@app.route('/verify-face', methods=['POST'])
def verify_face():
    data = request.json
    if not data or 'image' not in data:
        return jsonify({"status": "error", "message": "No image provided"}), 400

    image = decode_base64_image(data['image'])
    if image is None:
        return jsonify({"status": "error", "message": "Invalid image format"}), 400

    result = analyze_frame(image)
    return jsonify(result), 200


if __name__ == '__main__':
    print("══════════════════════════════════════════════════")
    print("  CodeArena Face Recognition Anti-Cheat API v2.1")
    print("  HTTP: http://localhost:8000/verify-face")
    print("  Head Tilt + Yaw Detection: ACTIVE")
    print("══════════════════════════════════════════════════")
    app.run(host='0.0.0.0', port=8000, debug=False)
