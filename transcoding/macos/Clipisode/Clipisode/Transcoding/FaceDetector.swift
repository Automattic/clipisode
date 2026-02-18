//
//  FaceDetector.swift
//  Clipisode
//

import AVFoundation
import Vision

enum FaceDetector {

    /// Detects the first face in a video file and returns its bounding box in pixel coordinates.
    /// The returned rect is in a top-left-origin coordinate system matching the render size.
    static func detectFace(in videoURL: URL, renderSize: CGSize) async -> CGRect? {
        let asset = AVURLAsset(url: videoURL)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.5, preferredTimescale: 600)

        let sampleTime = CMTime(seconds: 1.0, preferredTimescale: 600)

        guard let cgImage = try? generator.copyCGImage(at: sampleTime, actualTime: nil) else {
            print("⚠️ FaceDetector: could not extract frame")
            return nil
        }

        let request = VNDetectFaceRectanglesRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        do {
            try handler.perform([request])
        } catch {
            print("⚠️ FaceDetector: Vision request failed: \(error)")
            return nil
        }

        guard let face = request.results?.first else {
            print("⚠️ FaceDetector: no face found")
            return nil
        }

        // Vision returns a normalized rect with bottom-left origin.
        // Convert to pixel coordinates with top-left origin (flipped y).
        let box = face.boundingBox
        let x = box.origin.x * renderSize.width
        let y = (1.0 - box.origin.y - box.height) * renderSize.height
        let w = box.width * renderSize.width
        let h = box.height * renderSize.height

        return CGRect(x: x, y: y, width: w, height: h)
    }
}
