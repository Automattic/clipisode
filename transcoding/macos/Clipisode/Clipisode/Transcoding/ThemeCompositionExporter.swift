//
//  ThemeCompositionExporter.swift
//  Clipisode
//
//  Builds AVComposition and AVVideoComposition from theme elements; only elements are rendered.
//

import AVFoundation
import CoreGraphics
import CoreMedia

enum ThemeCompositionExporter {

    private static let renderSize = CGSize(width: 720, height: 1280)
    private static let timescale: CMTimeScale = 1000

    /// Export a composition defined by theme elements. Videos map key → local file URL.
    static func export(
        elements: [[String: Any]],
        videos: [String: URL],
        files: [String: String],
        to output: URL
    ) async throws {
        let composition = AVMutableComposition()
        var videoTrackIdMap: [String: CMPersistentTrackID] = [:]
        var videoPreferredTransforms: [String: CGAffineTransform] = [:]
        var frameMap: [String: CGImage] = [:]
        let extendTo: CMTime = {
            guard let maxEnd = elements.compactMap({ $0["endAt"] as? Double }).max() else { return CMTime(seconds: 0, preferredTimescale: timescale) }
            return CMTime(seconds: maxEnd, preferredTimescale: timescale)
        }()

        // Build frame map from "frame" elements
        for element in elements where (element["type"] as? String) == "frame" {
            guard let name = element["name"] as? String,
                  let props = element["props"] as? [String: Any],
                  let videoKey = props["videoKey"] as? String,
                  let assetURL = videos[videoKey] else { continue }
            let asset = AVURLAsset(url: assetURL)
            let position = props["position"]
            let cgImage: CGImage?
            if let pos = position as? String {
                cgImage = await assetFrame(asset: asset, position: pos)
            } else if let pos = position as? Double {
                cgImage = assetFrameSync(asset: asset, at: CMTime(seconds: pos, preferredTimescale: timescale))
            } else {
                cgImage = nil
            }
            if let cgImage { frameMap[name] = cgImage }
        }

        // Single audio track shared by all clips and the ending silence
        let sharedAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)

        // Add video and audio tracks from "video" elements
        for element in elements where (element["type"] as? String) == "video" {
            guard let videoKey = element["videoKey"] as? String,
                  let assetURL = videos[videoKey] else { continue }
            let asset = AVURLAsset(url: assetURL)
            let startAt = element["startAt"] as? Double ?? 0
            let endAt = element["endAt"] as? Double ?? 0
            let startAtTime = CMTime(seconds: startAt, preferredTimescale: timescale)
            let duration: CMTime
            if endAt > 0 {
                duration = CMTime(seconds: endAt - startAt, preferredTimescale: timescale)
            } else {
                let d = try? await asset.load(.duration)
                duration = d ?? CMTime(seconds: 0, preferredTimescale: timescale)
            }
            guard let videoTrack = asset.tracks(withMediaType: .video).first,
                  let compVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { continue }
            if let name = element["name"] as? String {
                videoTrackIdMap[name] = compVideoTrack.trackID
                if let transform = try? await videoTrack.load(.preferredTransform) {
                    videoPreferredTransforms[name] = transform
                }
            }
            let range = CMTimeRange(start: .zero, duration: duration)
            try? compVideoTrack.insertTimeRange(range, of: videoTrack, at: startAtTime)

            if let audioTrack = asset.tracks(withMediaType: .audio).first, let compAudioTrack = sharedAudioTrack {
                try? compAudioTrack.insertTimeRange(range, of: audioTrack, at: startAtTime)
            }
        }

        // Extend the shared audio track with silence to cover the ending card
        if let compAudioTrack = sharedAudioTrack, CMTimeCompare(extendTo, compAudioTrack.timeRange.end) > 0 {
            appendSilence(to: compAudioTrack, until: extendTo)
        }

        let requiredTrackIDs = Array(Set(videoTrackIdMap.values))
        let timeRange = CMTimeRange(start: .zero, duration: extendTo)
        let instruction = ThemeCompositionInstruction(
            elements: elements,
            videoTrackIdMap: videoTrackIdMap,
            videoPreferredTransforms: videoPreferredTransforms,
            frameMap: frameMap,
            files: files,
            renderSize: renderSize,
            timeRange: timeRange,
            requiredTrackIDs: requiredTrackIDs
        )

        let videoComposition = AVMutableVideoComposition()
        videoComposition.customVideoCompositorClass = ThemeCompositor.self
        videoComposition.renderSize = renderSize
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
        videoComposition.instructions = [instruction]

        try? FileManager.default.removeItem(at: output)
        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
            throw ExportError.exportSessionCreationFailed
        }
        session.videoComposition = videoComposition
        try await session.export(to: output, as: .mp4)
    }

    private static func assetFrame(asset: AVAsset, position: String) async -> CGImage? {
        let duration = (try? await asset.load(.duration)) ?? .zero
        let track = asset.tracks(withMediaType: .video).first
        let minFrame = track?.minFrameDuration ?? CMTime(value: 1, timescale: 30)
        let at: CMTime
        if position == "first" {
            at = .zero
        } else if position == "last" {
            at = CMTimeSubtract(duration, minFrame)
        } else {
            return nil
        }
        return assetFrameSync(asset: asset, at: at)
    }

    private static func assetFrameSync(asset: AVAsset, at: CMTime) -> CGImage? {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceAfter = .zero
        generator.requestedTimeToleranceBefore = .zero
        var actualTime: CMTime = .invalid
        return try? generator.copyCGImage(at: at, actualTime: &actualTime)
    }

    /// Appends silence to an existing audio track so it extends to `until`.
    private static func appendSilence(to track: AVMutableCompositionTrack, until end: CMTime) {
        let start = track.timeRange.end
        let gap = CMTimeSubtract(end, start)
        guard CMTimeGetSeconds(gap) > 0 else { return }

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("wav")
        defer { try? FileManager.default.removeItem(at: tempURL) }

        generateSilentWav(seconds: CMTimeGetSeconds(gap), at: tempURL)

        let asset = AVURLAsset(url: tempURL)
        guard let sourceTrack = asset.tracks(withMediaType: .audio).first else { return }

        let chunkDuration = sourceTrack.timeRange.duration
        var cursor = CMTime.zero
        while CMTimeCompare(cursor, gap) < 0 {
            let remaining = CMTimeSubtract(gap, cursor)
            let insert = CMTimeMinimum(chunkDuration, remaining)
            try? track.insertTimeRange(CMTimeRange(start: .zero, duration: insert), of: sourceTrack, at: CMTimeAdd(start, cursor))
            cursor = CMTimeAdd(cursor, insert)
        }
    }

    private static func generateSilentWav(seconds: Double, at url: URL) {
        let sampleRate: UInt32 = 8000
        let channels: UInt16 = 1
        let bitsPerSample: UInt16 = 16
        let numSamples = UInt32(Double(sampleRate) * seconds)
        let dataSize = numSamples * UInt32(channels) * UInt32(bitsPerSample / 8)
        let fileSize = 36 + dataSize

        var d = Data(capacity: 44 + Int(dataSize))
        func le<T: FixedWidthInteger>(_ v: T) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }

        d.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // RIFF
        le(fileSize)
        d.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // WAVE
        d.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // fmt
        le(UInt32(16))
        le(UInt16(1)) // PCM
        le(channels)
        le(sampleRate)
        le(sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8))
        le(channels * (bitsPerSample / 8))
        le(bitsPerSample)
        d.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // data
        le(dataSize)
        d.append(Data(count: Int(dataSize)))

        try? d.write(to: url)
    }
}
