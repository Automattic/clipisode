//
//  FaceDetector.swift
//  Clipisode
//

import AVFoundation
import Vision

/// Facial landmark positions converted to pixel coordinates (top-left origin).
struct FaceLandmarks {
    let faceRect: CGRect
    let leftEye: [CGPoint]
    let rightEye: [CGPoint]
    let nose: [CGPoint]
    let noseCrest: [CGPoint]
    let outerLips: [CGPoint]
    let leftEyebrow: [CGPoint]
    let rightEyebrow: [CGPoint]
    let faceContour: [CGPoint]

    var leftEyeCenter: CGPoint { center(of: leftEye) }
    var rightEyeCenter: CGPoint { center(of: rightEye) }
    var noseCenter: CGPoint { center(of: nose) }
    var mouthCenter: CGPoint { center(of: outerLips) }

    private func center(of points: [CGPoint]) -> CGPoint {
        guard !points.isEmpty else { return .zero }
        let sum = points.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
        return CGPoint(x: sum.x / CGFloat(points.count), y: sum.y / CGFloat(points.count))
    }
}

enum FaceDetector {

    /// Detects facial landmarks in a video file and returns them in pixel coordinates.
    static func detectLandmarks(in videoURL: URL, renderSize: CGSize) async -> FaceLandmarks? {
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

        let request = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        do {
            try handler.perform([request])
        } catch {
            print("⚠️ FaceDetector: Vision request failed: \(error)")
            return nil
        }

        guard let face = request.results?.first,
              let landmarks = face.landmarks else {
            print("⚠️ FaceDetector: no face or landmarks found")
            return nil
        }

        let box = face.boundingBox
        let faceRect = CGRect(
            x: box.origin.x * renderSize.width,
            y: (1.0 - box.origin.y - box.height) * renderSize.height,
            width: box.width * renderSize.width,
            height: box.height * renderSize.height
        )

        func convert(_ region: VNFaceLandmarkRegion2D?) -> [CGPoint] {
            guard let region else { return [] }
            return region.normalizedPoints.map { pt in
                // Points are normalized within the face bounding box (bottom-left origin).
                // Convert to full-frame pixel coords with top-left origin.
                CGPoint(
                    x: (box.origin.x + pt.x * box.width) * renderSize.width,
                    y: (1.0 - (box.origin.y + pt.y * box.height)) * renderSize.height
                )
            }
        }

        return FaceLandmarks(
            faceRect: faceRect,
            leftEye: convert(landmarks.leftEye),
            rightEye: convert(landmarks.rightEye),
            nose: convert(landmarks.nose),
            noseCrest: convert(landmarks.noseCrest),
            outerLips: convert(landmarks.outerLips),
            leftEyebrow: convert(landmarks.leftEyebrow),
            rightEyebrow: convert(landmarks.rightEyebrow),
            faceContour: convert(landmarks.faceContour)
        )
    }
}
