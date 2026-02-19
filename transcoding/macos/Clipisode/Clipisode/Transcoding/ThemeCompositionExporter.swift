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

            if let audioTrack = asset.tracks(withMediaType: .audio).first,
               let compAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
                try? compAudioTrack.insertTimeRange(range, of: audioTrack, at: startAtTime)
            }
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
}
