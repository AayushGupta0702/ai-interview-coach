import cv2
import numpy as np
import base64
from cv_analyzer import CVAnalyzer

def run_diagnostics():
    print("Initializing CVAnalyzer...")
    analyzer = CVAnalyzer()
    
    # Create a blank white image (simulate a clean background)
    img = np.ones((480, 640, 3), dtype=np.uint8) * 240
    
    # Draw a face (skin colored/white block) to satisfy Cascade detection
    # Haar Cascade requires some face contours. Let's load a real face image if available or check execution.
    # To test if the code compiles and runs without crash, we can feed it the blank image.
    
    # Encode to base64
    _, buffer = cv2.imencode('.jpg', img)
    base64_str = base64.b64encode(buffer).decode('utf-8')
    
    print("\nRunning analyze_frame on dummy frame...")
    metrics = analyzer.analyze_frame(base64_str)
    
    print("\n--- Telemetry Metrics Output ---")
    for k, v in metrics.items():
        print(f"{k}: {v}")
    print("--------------------------------")
    print("CVAnalyzer Diagnostic completed successfully.")

if __name__ == "__main__":
    run_diagnostics()
