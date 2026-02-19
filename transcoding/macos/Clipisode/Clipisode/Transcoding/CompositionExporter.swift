//
//  CompositionExporter.swift
//  Clipisode
//

import AVFoundation

enum CompositionExporter {

    private static let renderSize = CGSize(width: 720, height: 1280)

    /// Joins normalized segments with crossfade + zoom transitions, per-segment
    /// effects, and name badges — all rendered per-frame by `VideoCompositor`.
    static func export(
        segments: [URL],
        names: [String] = [],
        effects: [Set<SegmentEffect>] = [],
        ciFilters: [[CIFilterConfig]] = [],
        to output: URL,
        transitionDuration: TimeInterval = 1.0
    ) async throws {
        guard !segments.isEmpty else { return }

        let hasEffects = effects.contains { !$0.isEmpty }
        let hasFilters = ciFilters.contains { !$0.isEmpty }
        let hasNames = !names.isEmpty

        if segments.count == 1 && !hasEffects && !hasFilters && !hasNames {
            try FileManager.default.copyItem(at: segments[0], to: output)
            return
        }

        let transDur = CMTime(seconds: transitionDuration, preferredTimescale: 600)
        let composition = AVMutableComposition()

        // One video track per segment (the custom compositor composites them).
        var videoTracks: [AVMutableCompositionTrack] = []
        for _ in segments {
            guard let track = composition.addMutableTrack(
                withMediaType: .video,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                throw ExportError.compositionSetupFailed
            }
            videoTracks.append(track)
        }

        // Audio on alternating A/B tracks so overlapping segments don't collide.
        guard let audioTrackA = composition.addMutableTrack(
                  withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid),
              let audioTrackB = composition.addMutableTrack(
                  withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else {
            throw ExportError.compositionSetupFailed
        }
        let audioTracks = [audioTrackA, audioTrackB]

        // MARK: Insert segments

        struct Placement {
            let segmentIndex: Int
            let videoTrackID: CMPersistentTrackID
            let audioTrackIndex: Int
            let start: CMTime
            let duration: CMTime
            var end: CMTime { CMTimeAdd(start, duration) }
        }

        var placements: [Placement] = []
        var insertionTime = CMTime.zero

        for (index, url) in segments.enumerated() {
            let asset = AVURLAsset(url: url)
            let duration = try await asset.load(.duration)

            guard let videoAssetTrack = try await asset.loadTracks(withMediaType: .video).first else {
                throw ExportError.missingVideoTrack(url.lastPathComponent)
            }

            let range = CMTimeRange(start: .zero, duration: duration)
            try videoTracks[index].insertTimeRange(range, of: videoAssetTrack, at: insertionTime)

            let audioIdx = index % 2
            if let audioAssetTrack = try? await asset.loadTracks(withMediaType: .audio).first {
                try audioTracks[audioIdx].insertTimeRange(range, of: audioAssetTrack, at: insertionTime)
            }

            placements.append(Placement(
                segmentIndex: index,
                videoTrackID: videoTracks[index].trackID,
                audioTrackIndex: audioIdx,
                start: insertionTime,
                duration: duration
            ))

            if index < segments.count - 1 {
                insertionTime = CMTimeAdd(insertionTime, CMTimeSubtract(duration, transDur))
            }
        }

        let _totalDuration = placements.last!.end

        // MARK: Build segment metadata for the compositor

        let segmentInfos: [CompositionInstruction.Segment] = placements.map { p in
            CompositionInstruction.Segment(
                trackID: p.videoTrackID,
                timeRange: CMTimeRange(start: p.start, duration: p.duration),
                name: names.indices.contains(p.segmentIndex) ? names[p.segmentIndex] : nil,
                effects: effects.indices.contains(p.segmentIndex) ? effects[p.segmentIndex] : [],
                ciFilters: ciFilters.indices.contains(p.segmentIndex) ? ciFilters[p.segmentIndex] : []
            )
        }

        // MARK: Build video composition instructions

        // Create per-phase instructions so `requiredSourceTrackIDs` only lists
        // the tracks that actually have content at each point in time.
        var instructions: [CompositionInstruction] = []

        for i in 0..<placements.count {
            let p = placements[i]

            // Solo portion (between transitions)
            let soloStart = (i == 0) ? p.start : CMTimeAdd(p.start, transDur)
            let soloEnd = (i == placements.count - 1) ? p.end : CMTimeSubtract(p.end, transDur)

            if CMTimeCompare(soloEnd, soloStart) > 0 {
                instructions.append(CompositionInstruction(
                    timeRange: CMTimeRange(start: soloStart, end: soloEnd),
                    segments: segmentInfos,
                    transitionDuration: transDur,
                    renderSize: renderSize,
                    requiredTrackIDs: [p.videoTrackID]
                ))
            }

            // Transition overlap with the next segment
            if i < placements.count - 1 {
                let nextP = placements[i + 1]
                let transStart = CMTimeSubtract(p.end, transDur)

                instructions.append(CompositionInstruction(
                    timeRange: CMTimeRange(start: transStart, duration: transDur),
                    segments: segmentInfos,
                    transitionDuration: transDur,
                    renderSize: renderSize,
                    requiredTrackIDs: [p.videoTrackID, nextP.videoTrackID]
                ))
            }
        }

        instructions.sort { CMTimeCompare($0.timeRange.start, $1.timeRange.start) < 0 }

        let videoComposition = AVMutableVideoComposition()
        videoComposition.customVideoCompositorClass = VideoCompositor.self
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
        videoComposition.renderSize = renderSize
        videoComposition.instructions = instructions

        // MARK: Audio crossfade

        let audioMix = AVMutableAudioMix()
        var mixParameters: [AVMutableAudioMixInputParameters] = []

        for trackIdx in 0...1 {
            let params = AVMutableAudioMixInputParameters(track: audioTracks[trackIdx])

            for i in 0..<placements.count where placements[i].audioTrackIndex == trackIdx {
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

        guard let session = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetHighestQuality
        ) else {
            throw ExportError.exportSessionCreationFailed
        }

        session.videoComposition = videoComposition
        session.audioMix = audioMix

        try await session.export(to: output, as: .mp4)
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
