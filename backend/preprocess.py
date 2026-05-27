#!/usr/bin/env python3
"""
Receipt Image Preprocessing - Simplified version
Grayscale + Contrast enhancement + Slight threshold
Based on bhimrazy/receipt-ocr concept but simplified
"""

import cv2
import numpy as np
import sys
import base64
import os
import imutils


def preprocess_receipt(image_data):
    """
    Simplified preprocessing for better OCR:
    1. Grayscale
    2. Increase contrast
    3. Light threshold
    """
    try:
        # Decode base64 image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise ValueError("Could not decode image")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply contrast enhancement (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Apply light threshold to clean up noise
        thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        
        # Encode result
        success, encoded = cv2.imencode('.png', thresh)
        if success:
            return base64.b64encode(encoded).decode('utf-8')
        return None
        
    except Exception as e:
        print(f"Preprocessing error: {e}", file=sys.stderr)
        return None


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        
        if not os.path.exists(input_file):
            print(f"Input file not found: {input_file}", file=sys.stderr)
            sys.exit(1)
        
        with open(input_file, 'r') as f:
            data = f.read().strip()
        
        result = preprocess_receipt(data)
        
        if result:
            with open(output_file, 'w') as f:
                f.write(result)
            sys.exit(0)
        else:
            sys.exit(1)
    else:
        data = sys.stdin.read().strip()
        if not data:
            print("No input data", file=sys.stderr)
            sys.exit(1)
        
        result = preprocess_receipt(data)
        if result:
            print(result)
        else:
            sys.exit(1)