//
//  CompositionExporter.swift
//  Clipisode
//

import AVFoundation

enum CompositionExporter {

    private static let renderSize = CGSize(width: 1920, height: 1080)

    /// Joins normalized segments with ~1 s crossfade + zoom transitions and exports to `output`.
    static func export(
        segments: [URL],
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

        // MARK: Build video composition instructions (built-in compositor with layer instructions)

        var instructions: [AVMutableVideoCompositionInstruction] = []

        for i in 0..<placements.count {
            let p = placements[i]

            // Solo (passthrough) region
            let soloStart = (i == 0) ? p.start : CMTimeAdd(p.start, transDur)
            let soloEnd = (i == placements.count - 1) ? p.end : CMTimeSubtract(p.end, transDur)

            if CMTimeCompare(soloEnd, soloStart) > 0 {
                let inst = AVMutableVideoCompositionInstruction()
                inst.timeRange = CMTimeRange(start: soloStart, end: soloEnd)
                let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[p.trackIndex])
                inst.layerInstructions = [layer]
                instructions.append(inst)
            }

            // Transition region
            if i < placements.count - 1 {
                let nextP = placements[i + 1]
                let transStart = CMTimeSubtract(p.end, transDur)
                let transRange = CMTimeRange(start: transStart, duration: transDur)

                let inst = AVMutableVideoCompositionInstruction()
                inst.timeRange = transRange

                // Top layer: incoming clip fades in
                let toLayer = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTracks[nextP.trackIndex])
                toLayer.setOpacityRamp(fromStartOpacity: 0, toEndOpacity: 1, timeRange: transRange)

                // Bottom layer: outgoing clip with center-zoom push
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
