//
//  FaceTrackingRenderer.swift
//  Clipisode
//
//  Reads a video frame-by-frame, runs Vision face landmark detection on each,
//  and draws a neon wireframe overlay that tracks the face in real time.
//  Uses AVAssetReader + AVAssetWriter for reliable per-frame pixel access.
//

import AVFoundation
import Vision

enum FaceTrackingRenderer {

    nonisolated static func render(input: URL, output: URL) async throws {
        let asset = AVURLAsset(url: input)

        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            throw NSError(domain: "FaceTrackingRenderer", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "No video track found"])
        }

        let reader = try AVAssetReader(asset: asset)

        let videoOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ])
        reader.add(videoOutput)

        let audioTrack = try await asset.loadTracks(withMediaType: .audio).first
        var audioOutput: AVAssetReaderTrackOutput?
        if let audioTrack {
            let ao = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: nil)
            reader.add(ao)
            audioOutput = ao
        }

        let naturalSize = try await videoTrack.load(.naturalSize)
        let pixelWidth = Int(naturalSize.width)
        let pixelHeight = Int(naturalSize.height)

        let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)

        let writerVideoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: pixelWidth,
            AVVideoHeightKey: pixelHeight,
        ])
        writerVideoInput.expectsMediaDataInRealTime = false

        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: writerVideoInput,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: pixelWidth,
                kCVPixelBufferHeightKey as String: pixelHeight,
            ]
        )
        writer.add(writerVideoInput)

        var writerAudioInput: AVAssetWriterInput?
        if let audioTrack {
            let fmtDescs = try await audioTrack.load(.formatDescriptions)
            let wai = AVAssetWriterInput(mediaType: .audio, outputSettings: nil,
                                         sourceFormatHint: fmtDescs.first)
            wai.expectsMediaDataInRealTime = false
            writer.add(wai)
            writerAudioInput = wai
        }

        reader.startReading()
        writer.startWriting()
        writer.startSession(atSourceTime: .zero)

        let duration = CMTimeGetSeconds(try await asset.load(.duration))
        var frameCount = 0

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let queue = DispatchQueue(label: "com.clipisode.facetracker", qos: .userInitiated)
            queue.async {
                do {
                    while let sampleBuffer = videoOutput.copyNextSampleBuffer() {
                        autoreleasepool {
                            guard writer.status == .writing else { return }
                            guard let srcBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
                            let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
                            let frameTime = CMTimeGetSeconds(pts)

                            // Run face detection on the reader's pixel buffer (unlocked).
                            let request = VNDetectFaceLandmarksRequest()
                            try? VNImageRequestHandler(cvPixelBuffer: srcBuffer, options: [:]).perform([request])

                            // Copy pixel data to our own buffer so the reader can reclaim its buffer.
                            // Without this, the writer retains the reader's buffers for encoding and
                            // the reader's internal pool gets exhausted, blocking copyNextSampleBuffer.
                            var outBuffer: CVPixelBuffer?
                            CVPixelBufferCreate(nil, pixelWidth, pixelHeight,
                                                kCVPixelFormatType_32BGRA, nil, &outBuffer)
                            guard let outBuffer else { return }

                            CVPixelBufferLockBaseAddress(srcBuffer, .readOnly)
                            CVPixelBufferLockBaseAddress(outBuffer, [])

                            if let src = CVPixelBufferGetBaseAddress(srcBuffer),
                               let dst = CVPixelBufferGetBaseAddress(outBuffer) {
                                let srcBPR = CVPixelBufferGetBytesPerRow(srcBuffer)
                                let dstBPR = CVPixelBufferGetBytesPerRow(outBuffer)
                                let copyBytes = min(srcBPR, dstBPR)
                                for row in 0..<pixelHeight {
                                    memcpy(dst + row * dstBPR, src + row * srcBPR, copyBytes)
                                }
                            }

                            CVPixelBufferUnlockBaseAddress(srcBuffer, .readOnly)
                            // srcBuffer / sampleBuffer are now free — reader can recycle the buffer.

                            // Draw the face wireframe overlay on our copy (still locked for writing).
                            if let base = CVPixelBufferGetBaseAddress(outBuffer) {
                                let bpr = CVPixelBufferGetBytesPerRow(outBuffer)
                                if let ctx = CGContext(
                                    data: base, width: pixelWidth, height: pixelHeight,
                                    bitsPerComponent: 8, bytesPerRow: bpr,
                                    space: CGColorSpaceCreateDeviceRGB(),
                                    bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                                        | CGBitmapInfo.byteOrder32Little.rawValue
                                ) {
                                    if let face = request.results?.first, let lm = face.landmarks {
                                        drawOverlay(ctx: ctx, face: face, lm: lm,
                                                    w: CGFloat(pixelWidth), h: CGFloat(pixelHeight),
                                                    t: frameTime, dur: duration)
                                    }
                                }
                            }

                            CVPixelBufferUnlockBaseAddress(outBuffer, [])

                            while !writerVideoInput.isReadyForMoreMediaData {
                                Thread.sleep(forTimeInterval: 0.005)
                            }
                            adaptor.append(outBuffer, withPresentationTime: pts)

                            frameCount += 1
                            if frameCount % 30 == 0 {
                                print("🎬 FaceTracker: \(frameCount) frames (\(String(format: "%.1f", frameTime))s / \(String(format: "%.1f", duration))s)")
                            }
                        }
                    }

                    // Check if reader failed
                    if reader.status == .failed {
                        throw reader.error ?? NSError(
                            domain: "FaceTrackingRenderer", code: 4,
                            userInfo: [NSLocalizedDescriptionKey: "Reader failed"])
                    }

                    writerVideoInput.markAsFinished()

                    if let audioOutput, let writerAudioInput {
                        while let sampleBuffer = audioOutput.copyNextSampleBuffer() {
                            while !writerAudioInput.isReadyForMoreMediaData {
                                Thread.sleep(forTimeInterval: 0.005)
                            }
                            writerAudioInput.append(sampleBuffer)
                        }
                        writerAudioInput.markAsFinished()
                    }

                    writer.finishWriting {
                        if writer.status == .completed {
                            print("✅ FaceTracker: \(frameCount) frames rendered")
                            continuation.resume()
                        } else {
                            continuation.resume(throwing: writer.error ?? NSError(
                                domain: "FaceTrackingRenderer", code: 2,
                                userInfo: [NSLocalizedDescriptionKey: "Writer status: \(writer.status.rawValue)"]))
                        }
                    }
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Drawing

    nonisolated private static func drawOverlay(
        ctx: CGContext,
        face: VNFaceObservation,
        lm: VNFaceLandmarks2D,
        w: CGFloat, h: CGFloat,
        t: Double, dur: Double
    ) {
        let box = face.boundingBox

        let fadeIn = min(t / 0.5, 1.0)
        let fadeOut = min((dur - t) / 0.5, 1.0)
        let alpha = CGFloat(min(fadeIn, fadeOut))
        guard alpha > 0 else { return }

        func px(_ pt: CGPoint) -> CGPoint {
            CGPoint(x: (box.origin.x + pt.x * box.width) * w,
                    y: (box.origin.y + pt.y * box.height) * h)
        }

        func path(_ r: VNFaceLandmarkRegion2D?, closed: Bool) -> CGPath? {
            guard let r, r.pointCount >= 2 else { return nil }
            let p = CGMutablePath()
            let pts = r.normalizedPoints
            p.move(to: px(pts[0]))
            for pt in pts.dropFirst() { p.addLine(to: px(pt)) }
            if closed { p.closeSubpath() }
            return p
        }

        func center(_ r: VNFaceLandmarkRegion2D?) -> CGPoint? {
            guard let r, r.pointCount > 0 else { return nil }
            let pts = r.normalizedPoints
            let s = pts.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
            return px(CGPoint(x: s.x / CGFloat(pts.count), y: s.y / CGFloat(pts.count)))
        }

        let cyan: (CGFloat, CGFloat, CGFloat) = (0, 0.9, 1)
        let magenta: (CGFloat, CGFloat, CGFloat) = (1, 0.1, 0.6)

        let features: [(VNFaceLandmarkRegion2D?, Bool, (CGFloat, CGFloat, CGFloat))] = [
            (lm.faceContour, false, cyan),
            (lm.leftEyebrow, false, cyan),
            (lm.rightEyebrow, false, cyan),
            (lm.leftEye, true, cyan),
            (lm.rightEye, true, cyan),
            (lm.nose, false, cyan),
            (lm.noseCrest, false, cyan),
            (lm.outerLips, true, magenta),
        ]

        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)

        for (region, closed, color) in features {
            guard let p = path(region, closed: closed) else { continue }
            let (r, g, b) = color

            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.12 * alpha))
            ctx.setLineWidth(10)
            ctx.addPath(p); ctx.strokePath()

            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.35 * alpha))
            ctx.setLineWidth(4)
            ctx.addPath(p); ctx.strokePath()

            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.9 * alpha))
            ctx.setLineWidth(1.5)
            ctx.addPath(p); ctx.strokePath()
        }

        if let le = center(lm.leftEye), let re = center(lm.rightEye),
           let n = center(lm.nose), let m = center(lm.outerLips) {

            ctx.setStrokeColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.2 * alpha))
            ctx.setLineWidth(1)
            ctx.setLineDash(phase: 0, lengths: [4, 4])

            for (from, to) in [(le, re), (le, n), (re, n), (n, m), (le, m), (re, m)] {
                ctx.move(to: from); ctx.addLine(to: to)
            }
            ctx.strokePath()
            ctx.setLineDash(phase: 0, lengths: [])
        }

        let pulse = 1.0 + 0.3 * sin(t * 6.0)

        var dots: [(CGPoint, CGFloat)] = []
        for (region, radius) in [(lm.leftEye, 4.0), (lm.rightEye, 4.0),
                                 (lm.nose, 4.0), (lm.outerLips, 4.0)] as [(VNFaceLandmarkRegion2D?, Double)] {
            if let c = center(region) { dots.append((c, CGFloat(radius))) }
        }
        for eye in [lm.leftEye, lm.rightEye] {
            if let eye, eye.pointCount >= 2 {
                let pts = eye.normalizedPoints
                dots.append((px(pts[0]), 3))
                dots.append((px(pts[pts.count / 2]), 3))
            }
        }
        if let lips = lm.outerLips, lips.pointCount >= 2 {
            let pts = lips.normalizedPoints
            dots.append((px(pts[0]), 3))
            dots.append((px(pts[pts.count / 2]), 3))
        }

        for (point, baseR) in dots {
            let r = baseR * CGFloat(pulse)

            ctx.setFillColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.25 * alpha))
            ctx.fillEllipse(in: CGRect(x: point.x - r * 2, y: point.y - r * 2, width: r * 4, height: r * 4))

            ctx.setFillColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.9 * alpha))
            ctx.fillEllipse(in: CGRect(x: point.x - r, y: point.y - r, width: r * 2, height: r * 2))
        }

        let faceMinX = box.origin.x * w - 30
        let faceMaxX = (box.origin.x + box.width) * w + 30
        let faceMinY = box.origin.y * h
        let faceMaxY = (box.origin.y + box.height) * h

        let phase = t.truncatingRemainder(dividingBy: 2.0) / 2.0
        let scanY = faceMaxY - (faceMaxY - faceMinY) * CGFloat(phase)

        let cs = CGColorSpaceCreateDeviceRGB()
        let colors = [
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.6 * alpha),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
        ] as CFArray

        if let grad = CGGradient(colorsSpace: cs, colors: colors, locations: [0, 0.5, 1]) {
            ctx.saveGState()
            ctx.clip(to: CGRect(x: faceMinX, y: scanY - 1, width: faceMaxX - faceMinX, height: 2))
            ctx.drawLinearGradient(grad,
                                   start: CGPoint(x: faceMinX, y: scanY),
                                   end: CGPoint(x: faceMaxX, y: scanY),
                                   options: [])
            ctx.restoreGState()
        }
    }
}
