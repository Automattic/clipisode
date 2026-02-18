//
//  CompositionExporter.swift
//  Clipisode
//

import AVFoundation
import AppKit
import QuartzCore

enum CompositionExporter {

    private static let renderSize = CGSize(width: 720, height: 1280)

    /// Joins normalized segments with ~1 s crossfade + zoom transitions and exports to `output`.
    /// If `names` is provided and matches the segment count, a blue gradient lower-third with each
    /// person's name is composited over the corresponding clip, fading in and out.
    static func export(
        segments: [URL],
        names: [String] = [],
        overlays: [[CALayer]] = [],
        to output: URL,
        transitionDuration: TimeInterval = 1.0
    ) async throws {
        guard !segments.isEmpty else { return }

        if segments.count == 1 {
            try FileManager.default.copyItem(at: segments[0], to: output)
            return
        }

        let transDur = CMTime(seconds: transitionDuration, preferredTimescale: 600)
        let composition = AVMutableComposition()

        guard let videoTrackA = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let videoTrackB = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let audioTrackA = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid),
              let audioTrackB = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else {
            throw ExportError.compositionSetupFailed
        }

        let videoTracks = [videoTrackA, videoTrackB]
        let audioTracks = [audioTrackA, audioTrackB]

        // MARK: Insert segments onto alternating tracks with overlap

        struct Placement {
            let trackIndex: Int
            let start: CMTime
            let duration: CMTime
            var end: CMTime { CMTimeAdd(start, duration) }
        }

        var placements: [Placement] = []
        var insertionTime = CMTime.zero

        for (index, url) in segments.enumerated() {
            let asset = AVURLAsset(url: url)
            let duration = try await asset.load(.duration)
            let trackIdx = index % 2

            guard let videoAssetTrack = try await asset.loadTracks(withMediaType: .video).first else {
                throw ExportError.missingVideoTrack(url.lastPathComponent)
            }

            let range = CMTimeRange(start: .zero, duration: duration)
            try videoTracks[trackIdx].insertTimeRange(range, of: videoAssetTrack, at: insertionTime)

            if let audioAssetTrack = try? await asset.loadTracks(withMediaType: .audio).first {
                try audioTracks[trackIdx].insertTimeRange(range, of: audioAssetTrack, at: insertionTime)
            }

            placements.append(Placement(trackIndex: trackIdx, start: insertionTime, duration: duration))

            if index < segments.count - 1 {
                insertionTime = CMTimeAdd(insertionTime, CMTimeSubtract(duration, transDur))
            }
        }

        // MARK: Build video composition instructions

        var instructions: [AVMutableVideoCompositionInstruction] = []

        for i in 0..<placements.count {
            let p = placements[i]

            let soloStart = (i == 0) ? p.start : CMTimeAdd(p.start, transDur)
            let soloEnd = (i == placements.count - 1) ? p.end : CMTimeSubtract(p.end, transDur)

            if CMTimeCompare(soloEnd, soloStart) > 0 {
                let inst = AVMutableVideoCompositionInstruction()
                inst.timeRange = CMTimeRange(start: soloStart, end: soloEnd)
                let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[p.trackIndex])
                inst.layerInstructions = [layer]
                instructions.append(inst)
            }

            if i < placements.count - 1 {
                let nextP = placements[i + 1]
                let transStart = CMTimeSubtract(p.end, transDur)
                let transRange = CMTimeRange(start: transStart, duration: transDur)

                let inst = AVMutableVideoCompositionInstruction()
                inst.timeRange = transRange

                let toLayer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[nextP.trackIndex])
                toLayer.setOpacityRamp(fromStartOpacity: 0, toEndOpacity: 1, timeRange: transRange)

                let fromLayer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[p.trackIndex])
                let endScale: CGFloat = 1.08
                let cx = renderSize.width / 2
                let cy = renderSize.height / 2
                let endTransform = CGAffineTransform(translationX: -cx, y: -cy)
                    .scaledBy(x: endScale, y: endScale)
                    .translatedBy(x: cx, y: cy)
                fromLayer.setTransformRamp(fromStart: .identity, toEnd: endTransform, timeRange: transRange)

                inst.layerInstructions = [toLayer, fromLayer]
                instructions.append(inst)
            }
        }

        instructions.sort { CMTimeCompare($0.timeRange.start, $1.timeRange.start) < 0 }

        let videoComposition = AVMutableVideoComposition()
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
        videoComposition.renderSize = renderSize
        videoComposition.instructions = instructions

        // MARK: Overlays (CoreAnimation)

        let hasNames = names.count == placements.count
        let hasOverlays = overlays.count == placements.count

        if hasNames || hasOverlays {
            let totalSeconds = CMTimeGetSeconds(placements.last!.end)

            let parentLayer = CALayer()
            parentLayer.frame = CGRect(origin: .zero, size: renderSize)
            parentLayer.isGeometryFlipped = true

            let videoLayer = CALayer()
            videoLayer.frame = parentLayer.bounds
            parentLayer.addSublayer(videoLayer)

            let overlayLayer = CALayer()
            overlayLayer.frame = parentLayer.bounds
            parentLayer.addSublayer(overlayLayer)

            // Per-segment effect overlays (glow rings, particles, etc.)
            if hasOverlays {
                for (i, layers) in overlays.enumerated() where i < placements.count {
                    for layer in layers {
                        overlayLayer.addSublayer(layer)
                    }
                }
            }

            // Name badges (rendered on top of effect overlays)
            if hasNames {
                for (i, placement) in placements.enumerated() {
                    let badge = buildNameBadge(
                        name: names[i],
                        placementStart: CMTimeGetSeconds(placement.start),
                        placementEnd: CMTimeGetSeconds(placement.end),
                        totalDuration: totalSeconds
                    )
                    overlayLayer.addSublayer(badge)
                }
            }

            videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
                postProcessingAsVideoLayer: videoLayer,
                in: parentLayer
            )
        }

        // MARK: Audio crossfade

        let audioMix = AVMutableAudioMix()
        var mixParameters: [AVMutableAudioMixInputParameters] = []

        for trackIdx in 0...1 {
            let params = AVMutableAudioMixInputParameters(track: audioTracks[trackIdx])

            for i in 0..<placements.count where placements[i].trackIndex == trackIdx {
                let p = placements[i]

                if i > 0 {
                    let rampRange = CMTimeRange(start: p.start, duration: transDur)
                    params.setVolumeRamp(fromStartVolume: 0, toEndVolume: 1, timeRange: rampRange)
                }

                if i < placements.count - 1 {
                    let rampStart = CMTimeSubtract(p.end, transDur)
                    let rampRange = CMTimeRange(start: rampStart, duration: transDur)
                    params.setVolumeRamp(fromStartVolume: 1, toEndVolume: 0, timeRange: rampRange)
                }
            }

            mixParameters.append(params)
        }

        audioMix.inputParameters = mixParameters

        // MARK: Export

        try? FileManager.default.removeItem(at: output)

        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
            throw ExportError.exportSessionCreationFailed
        }

        session.videoComposition = videoComposition
        session.audioMix = audioMix
        session.outputURL = output
        session.outputFileType = .mp4

        await session.export()

        switch session.status {
        case .completed:
            return
        case .cancelled:
            throw CancellationError()
        default:
            throw session.error ?? ExportError.unknownExportFailure
        }
    }

    // MARK: - Name Badge Builder

    private static func buildNameBadge(
        name: String,
        placementStart: Double,
        placementEnd: Double,
        totalDuration: Double
    ) -> CALayer {
        let badgeHeight: CGFloat = 120
        let fadeDuration: TimeInterval = 0.5
        let delayAfterStart: TimeInterval = 0.8
        let delayBeforeEnd: TimeInterval = 0.8

        let badge = CALayer()
        badge.frame = CGRect(x: 0, y: renderSize.height - badgeHeight, width: renderSize.width, height: badgeHeight)
        badge.opacity = 0

        // Blue gradient background: transparent at top → deep blue at bottom
        let gradient = CAGradientLayer()
        gradient.frame = badge.bounds
        gradient.colors = [
            CGColor(srgbRed: 0, green: 0.12, blue: 0.35, alpha: 0),
            CGColor(srgbRed: 0, green: 0.12, blue: 0.35, alpha: 0.88),
        ]
        gradient.startPoint = CGPoint(x: 0.5, y: 0)
        gradient.endPoint = CGPoint(x: 0.5, y: 1)
        badge.addSublayer(gradient)

        // Render name text into an image (CATextLayer doesn't render in offline export)
        let textImage = renderTextImage(
            name,
            size: CGSize(width: renderSize.width - 72, height: 48),
            font: NSFont.systemFont(ofSize: 32, weight: .medium),
            color: .white
        )
        let textLayer = CALayer()
        textLayer.frame = CGRect(x: 36, y: 40, width: renderSize.width - 72, height: 48)
        textLayer.contents = textImage
        textLayer.contentsGravity = .left
        badge.addSublayer(textLayer)

        // Keyframe opacity animation: hidden → fade in → visible → fade out → hidden
        let fadeInStart = placementStart + delayAfterStart
        let fadeInEnd = fadeInStart + fadeDuration
        let fadeOutStart = placementEnd - delayBeforeEnd - fadeDuration
        let fadeOutEnd = fadeOutStart + fadeDuration

        let anim = CAKeyframeAnimation(keyPath: "opacity")
        anim.beginTime = AVCoreAnimationBeginTimeAtZero
        anim.duration = totalDuration
        anim.isRemovedOnCompletion = false
        anim.fillMode = .forwards
        anim.calculationMode = .linear

        anim.keyTimes = [
            0,
            NSNumber(value: max(fadeInStart, 0) / totalDuration),
            NSNumber(value: fadeInEnd / totalDuration),
            NSNumber(value: max(fadeOutStart, fadeInEnd) / totalDuration),
            NSNumber(value: min(fadeOutEnd, totalDuration) / totalDuration),
            1,
        ]
        anim.values = [0, 0, 1, 1, 0, 0] as [NSNumber]

        badge.add(anim, forKey: "opacity")

        return badge
    }

    private static func renderTextImage(
        _ text: String,
        size: CGSize,
        font: NSFont,
        color: NSColor
    ) -> CGImage? {
        let scale: CGFloat = 2
        let pixelWidth = Int(size.width * scale)
        let pixelHeight = Int(size.height * scale)

        guard let context = CGContext(
            data: nil,
            width: pixelWidth,
            height: pixelHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
        ) else { return nil }

        context.scaleBy(x: scale, y: scale)

        let gc = NSGraphicsContext(cgContext: context, flipped: false)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = gc

        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
        ]
        let attrStr = NSAttributedString(string: text, attributes: attrs)
        attrStr.draw(in: CGRect(origin: .zero, size: size))

        NSGraphicsContext.restoreGraphicsState()

        return context.makeImage()
    }
}

// MARK: - Errors

enum ExportError: LocalizedError {
    case compositionSetupFailed
    case missingVideoTrack(String)
    case exportSessionCreationFailed
    case unknownExportFailure

    var errorDescription: String? {
        switch self {
        case .compositionSetupFailed:
            return "Failed to create composition tracks"
        case .missingVideoTrack(let name):
            return "No video track in \(name)"
        case .exportSessionCreationFailed:
            return "Could not create AVAssetExportSession"
        case .unknownExportFailure:
            return "Export failed with an unknown error"
        }
    }
}
