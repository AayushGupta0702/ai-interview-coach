import cv2
import numpy as np
import base64
import logging
import math

logger = logging.getLogger("cv_analyzer")

class CVAnalyzer:
    def __init__(self):
        # Load OpenCV pre-packaged Haar Cascades
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        self.smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_smile.xml')
        
        # Check if cascades loaded correctly
        if self.face_cascade.empty() or self.eye_cascade.empty() or self.smile_cascade.empty():
            logger.error("Failed to load one or more Haar Cascades.")
        else:
            logger.info("OpenCV Haar Cascades loaded successfully.")
            
        # Calibration state
        self.baseline_face_y = None
        self.baseline_face_x = None
        self.baseline_face_h = None
        self.frame_count = 0
        
        # Keep track of recent states for stability
        self.recent_eye_counts = []
        self.recent_expressions = []

    def decode_base64_image(self, base64_str: str) -> np.ndarray:
        """Decodes base64 string to OpenCV image (BGR)."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            img_bytes = base64.b64decode(base64_str)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
            return None

    def analyze_frame(self, base64_frame: str) -> dict:
        """Analyzes a single frame using Haar Cascades and returns metrics."""
        self.frame_count += 1
        
        img = self.decode_base64_image(base64_frame)
        if img is None:
            return {"error": "Invalid frame data"}
        
        h, w, _ = img.shape
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Equalize histogram to make it robust to lighting changes
        gray = cv2.equalizeHist(gray)
        
        # Detect faces (using standard parameters for face size and neighbors)
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1, 
            minNeighbors=5, 
            minSize=(80, 80)
        )
        
        # If no face is detected
        if len(faces) == 0:
            return {
                "posture": "Not Detected",
                "posture_score": 50,
                "eye_contact": False,
                "eye_contact_score": 40,
                "expression": "Not Detected",
                "expression_score": 50,
                "feedback": ["Position yourself in front of the camera.", "Make sure your face is well-lit."]
            }
            
        # Select the largest detected face (assumed to be the candidate)
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        (fx, fy, fw, fh) = faces[0]
        
        face_cx = fx + (fw / 2)
        face_cy = fy + (fh / 2)
        
        # 1. Posture Analytics
        # Calibration over the first 15 frames
        if self.frame_count <= 15:
            if self.baseline_face_y is None:
                self.baseline_face_y = face_cy
                self.baseline_face_x = face_cx
                self.baseline_face_h = fh
            else:
                # Running average calibration
                self.baseline_face_y = (self.baseline_face_y * 0.8) + (face_cy * 0.2)
                self.baseline_face_x = (self.baseline_face_x * 0.8) + (face_cx * 0.2)
                self.baseline_face_h = (self.baseline_face_h * 0.8) + (fh * 0.2)

        posture = "Good"
        posture_score = 100
        feedback = []
        
        if self.baseline_face_y is not None:
            # If the face center moves down (slouching)
            # Threshold: face center shifted down by more than 10% of baseline face height
            y_diff = face_cy - self.baseline_face_y
            h_threshold = self.baseline_face_h * 0.18
            
            if y_diff > h_threshold:
                posture = "Slouching"
                posture_score = max(50, int(100 - (y_diff / h_threshold) * 20))
                feedback.append("Sit up straight.")
            
            # Leaning left or right
            x_diff = abs(face_cx - self.baseline_face_x)
            w_threshold = self.baseline_face_h * 0.25
            if x_diff > w_threshold:
                posture = "Leaning"
                posture_score = min(posture_score, max(60, int(100 - (x_diff / w_threshold) * 15)))
                feedback.append("Center yourself in the frame.")

        # 2. Eye Contact Analytics
        # Crop eye region (upper 55% of the face box)
        eye_roi_gray = gray[fy : fy + int(fh * 0.55), fx : fx + fw]
        eyes = self.eye_cascade.detectMultiScale(
            eye_roi_gray,
            scaleFactor=1.1,
            minNeighbors=3,
            minSize=(15, 15)
        )
        
        # Smooth eye counts over past 5 frames to prevent blinking causing fake "Looking Away" flags
        self.recent_eye_counts.append(len(eyes))
        if len(self.recent_eye_counts) > 5:
            self.recent_eye_counts.pop(0)
            
        avg_eyes = sum(self.recent_eye_counts) / len(self.recent_eye_counts)
        
        eye_contact = True
        eye_contact_score = 100
        
        # If average eye count is less than 0.8 (meaning eyes are not detected regularly)
        if avg_eyes < 0.8:
            eye_contact = False
            eye_contact_score = 50
            feedback.append("Look directly at the camera.")

        # 3. Expression Analytics
        # Crop mouth region (bottom 40% of the face box)
        mouth_roi_gray = gray[fy + int(fh * 0.60) : fy + fh, fx : fx + fw]
        
        # Detect smile
        # minNeighbors=15 ensures high confidence before reporting a smile
        smiles = self.smile_cascade.detectMultiScale(
            mouth_roi_gray,
            scaleFactor=1.1,
            minNeighbors=15,
            minSize=(25, 15)
        )
        
        detected_expression = "Neutral"
        expression_score = 90
        
        if len(smiles) > 0:
            detected_expression = "Smiling"
            expression_score = 100
        else:
            # If eyes are detected but no smile, and candidate is moving slightly
            # We can classify as Concentrated or Engaged
            if len(eyes) >= 2:
                detected_expression = "Focused"
                expression_score = 95
            else:
                detected_expression = "Neutral"
                expression_score = 90
                
        # Smooth expressions
        self.recent_expressions.append(detected_expression)
        if len(self.recent_expressions) > 8:
            self.recent_expressions.pop(0)
            
        # Select the most frequent expression in the buffer
        expression = max(set(self.recent_expressions), key=self.recent_expressions.count)

        return {
            "posture": posture,
            "posture_score": posture_score,
            "eye_contact": eye_contact,
            "eye_contact_score": eye_contact_score,
            "expression": expression,
            "expression_score": expression_score,
            "feedback": feedback
        }
