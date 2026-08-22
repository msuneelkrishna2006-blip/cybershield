/**
 * CyberShield India — OCR API
 * POST /api/v1/ocr
 *
 * Extracts text from uploaded images using browser-compatible OCR.
 * Used by the scanner to analyze screenshots of suspicious messages.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return apiError('MISSING_FILE', 'No file uploaded', 400);
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return apiError('INVALID_FILE_TYPE', 'Only JPEG, PNG, WebP, and GIF images are supported', 400);
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return apiError('FILE_TOO_LARGE', 'Image must be under 5MB', 400);
    }

    // For server-side OCR, we use a lightweight approach:
    // 1. In production, this would integrate with Google Cloud Vision API or Tesseract.js worker
    // 2. For now, return a placeholder that tells the client to use client-side Tesseract.js
    //
    // NOTE: Full server-side OCR requires either:
    //   - Google Cloud Vision API (GOOGLE_VISION_API_KEY env var)
    //   - Tesseract.js (heavy, ~25MB WASM module)
    //   - Azure Computer Vision
    //
    // The client-side scanner already handles OCR via Tesseract.js in the browser.
    // This endpoint exists for API completeness and future server-side OCR integration.

    const hasVisionApi = !!process.env.GOOGLE_VISION_API_KEY;

    if (hasVisionApi) {
      // Google Cloud Vision OCR (when configured)
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      const arrayBuffer = await file.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString('base64');

      try {
        const visionRes = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: [{
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              }],
            }),
          }
        );

        const visionData = await visionRes.json();
        const annotation = visionData?.responses?.[0]?.fullTextAnnotation;

        if (annotation?.text) {
          return apiSuccess({
            success: true,
            text: annotation.text,
            confidence: 0.95,
            provider: 'google-vision',
          });
        }

        return apiSuccess({
          success: true,
          text: '',
          confidence: 0,
          provider: 'google-vision',
          message: 'No text detected in image',
        });
      } catch (visionError) {
        console.error('[OCR] Vision API error:', visionError);
        return apiError('OCR_FAILED', 'OCR processing failed. Try pasting the text manually.', 500);
      }
    }

    // No server-side OCR configured — instruct client to use browser-based OCR
    return apiSuccess({
      success: false,
      text: '',
      useClientOcr: true,
      message: 'Server-side OCR not configured. Use browser-based text extraction.',
    });
  } catch (error) {
    console.error('[OCR] Error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'OCR processing failed', 500);
  }
}
