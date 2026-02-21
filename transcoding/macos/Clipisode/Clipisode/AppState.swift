//
//  AppState.swift
//  Clipisode
//

import Foundation
import SwiftUI
import Observation
import CoreImage

struct LastRender {
    enum Result {
        case success
        case error(String)
        case cancelled
    }
    
    let startedAt: Date
    let finishedAt: Date
    let videoCount: Int
    let result: Result
    
    var duration: TimeInterval { finishedAt.timeIntervalSince(startedAt) }
}

/// Shared reference so the app delegate can run the launch render.
enum AppStateHolder {
    static weak var shared: AppState?
}

@Observable
@MainActor
final class AppState {
    var isWorking = false
    var isConnected = false
    var serverError: String?
    var lastRender: LastRender?
    
    private var webSocketServer: WebSocketServer?
    private var httpServer: HTTPServer?
    private var renderTask: Task<Void, Never>?
    private var currentJobId: String?
    
    var jobsFolder: URL { FileLocations.jobsFolder }
    
    var cacheSize: String {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: FileLocations.sourcesFolder, includingPropertiesForKeys: [.fileSizeKey]) else {
            return "0 MB"
        }
        
        var total: Int64 = 0
        for file in files {
            if let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                total += Int64(size)
            }
        }
        
        let mb = Double(total) / 1_000_000
        return String(format: "%.1f MB", mb)
    }
    
    init() {
        // Create file directories
        try? FileLocations.ensureDirectoriesExist()
        
        // Initialize servers
        setupServers()
        
        // Run cleanup
        CleanupManager.runOnLaunch()
    }
    
    // MARK: - Local Job
    
    /// Combine local video files and write the result to a specified output URL.
    /// Each input is used in full (no trimming). Progress is reflected in `isWorking`.
    func runLocalJob(inputs: [URL], names: [String] = [], output: URL) {
        guard !isWorking else { return }
        isWorking = true
        
        Task {
            do {
                let jobId = UUID().uuidString
                let jobFolder = FileLocations.jobFolder(jobId)
                let tempFolder = FileLocations.tempFolder(jobId)
                try FileManager.default.createDirectory(at: jobFolder, withIntermediateDirectories: true)
                try FileManager.default.createDirectory(at: tempFolder, withIntermediateDirectories: true)
                
                // Trim / normalise each input with per-segment FFmpeg effects
                var segmentFiles: [URL] = []
                for (index, input) in inputs.enumerated() {
                    let segmentFile = tempFolder.appendingPathComponent(
                        "segment_\(String(format: "%02d", index + 1)).mp4"
                    )
                    let extraFilters: String? = (index == 0)
                        ? "rgbashift=rh=-3:rv=2:bh=3:bv=-2,eq=contrast=1.15:brightness=0.02:saturation=1.3,vignette=PI/4"
                        : nil
                    try await FFmpegRunner.trim(input: input, start: nil, end: nil, extraFilters: extraFilters, output: segmentFile)
                    segmentFiles.append(segmentFile)
                }
                
                // Declare per-segment compositor effects (face tracking, particles, etc.)
                // The custom VideoCompositor handles these per-frame during export.
                var effects: [Set<SegmentEffect>] = Array(repeating: [], count: segmentFiles.count)
                if segmentFiles.count > 1 { effects[1] = [.faceTracking] }
                if segmentFiles.count > 2 { effects[2] = [.particles] }
                
                // Per-segment CIFilters applied in the compositor's rendering pipeline.
                var ciFilters: [[CIFilterConfig]] = Array(repeating: [], count: segmentFiles.count)
                
                if segmentFiles.count > 0 {
                    // Segment 0: bloom glow that builds from crisp to dreamy
                    ciFilters[0] = [
                        CIFilterConfig(
                            name: "CIBloom",
                            parameters: ["inputRadius": 4.0, "inputIntensity": 0.0],
                            endParameters: ["inputRadius": 25.0, "inputIntensity": 1.5]
                        ),
                    ]
                }
                if segmentFiles.count > 1 {
                    // Segment 1: X-ray negative — inverted clinical look with face wireframe
                    ciFilters[1] = [
                        CIFilterConfig(name: "CIXRay", parameters: [:]),
                    ]
                }
                if segmentFiles.count > 2 {
                    // Segment 2: edge detection glow + sepia — neon outlines over warm tone
                    ciFilters[2] = [
                        CIFilterConfig(name: "CIEdges", parameters: [
                            "inputIntensity": 5.0,
                        ]),
                        CIFilterConfig(name: "CISepiaTone", parameters: [
                            "inputIntensity": 0.6,
                        ]),
                    ]
                }
                
                try await CompositionExporter.export(
                    segments: segmentFiles,
                    names: names,
                    effects: effects,
                    ciFilters: ciFilters,
                    to: output
                )
                
                try? FileManager.default.removeItem(at: tempFolder)
                
                print("✅ Local job complete: \(output.path)")
            } catch {
                print("❌ Local job failed: \(error.localizedDescription)")
            }
            
            isWorking = false
        }
    }
    
    private func setupServers() {
        let ws = WebSocketServer()
        let http = HTTPServer()
        
        self.webSocketServer = ws
        self.httpServer = http
        
        ws.onMessage = { [weak self] message in
            Task { @MainActor in
                self?.handleMessage(message)
            }
        }
        
        ws.onConnectionChange = { [weak self] connected in
            Task { @MainActor in
                self?.isConnected = connected
            }
        }
        
        do {
            try ws.start(port: 63481)
            try http.start(port: 63482, basePath: FileLocations.jobsFolder)
        } catch {
            self.serverError = error.localizedDescription
        }
    }
    
    // MARK: - Message Handling
    
    private func handleMessage(_ data: Data) {
        guard let base = try? JSONDecoder().decode(IncomingMessage.self, from: data) else {
            return
        }
        
        switch base.type {
        case "hello":
            webSocketServer?.send(HelloAck())
            
        case "start_job":
            do {
                let payload = try StartJobPayload.parse(data: data)
                startRenderJob(payload: payload)
            } catch let err as StartJobParseError {
                switch err {
                case .invalid(let msg): print("❌ start_job: \(msg)")
                }
            } catch {
                print("❌ Failed to parse start_job: \(error)")
            }
            
        case "cancel_job":
            guard let msg = try? JSONDecoder().decode(CancelJobMessage.self, from: data) else { return }
            cancelJob(msg.jobId)
            
        default:
            break
        }
    }
    
    // MARK: - Render Request Handling
    
    private func startRenderJob(payload: StartJobPayload) {
        guard !isWorking else {
            webSocketServer?.send(ConnectionRejected(reason: "Already processing a job."))
            return
        }
        isWorking = true

        let jobId = payload.jobId
        currentJobId = jobId
        let videoCount = payload.videos.count
        let assetCount = payload.assets.count
        let totalDownloads = videoCount + assetCount
        let useTheme = (payload.elements?.isEmpty == false)
        let jobStartedAt = Date()
        print("🚀 Job \(jobId): \(videoCount) video(s), \(assetCount) asset(s), theme: \(useTheme), callback: \(payload.callbackUrl)")

        renderTask = Task {
            do {
                let tempDir = FileLocations.tempFolder(jobId)
                let jobFolder = FileLocations.jobFolder(jobId)
                try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
                try FileManager.default.createDirectory(at: jobFolder, withIntermediateDirectories: true)

                // 1. Download videos
                let sortedKeys = payload.videos.keys.sorted()
                var localFiles: [URL] = []
                for (index, key) in sortedKeys.enumerated() {
                    try Task.checkCancellation()
                    let video = payload.videos[key]!
                    guard let url = URL(string: video.url) else {
                        throw JobError.downloadFailed("Invalid URL for video '\(key)': \(video.url)")
                    }

                    sendStatus(jobId: jobId, phase: "downloading", current: index, total: totalDownloads,
                              message: "Downloading \(key) (\(index + 1)/\(totalDownloads))")

                    let (tempURL, response) = try await URLSession.shared.download(from: url)

                    guard let httpResponse = response as? HTTPURLResponse,
                          (200...299).contains(httpResponse.statusCode) else {
                        throw JobError.downloadFailed("HTTP error downloading '\(key)'")
                    }

                    let localFile = tempDir.appendingPathComponent("\(key)_\(video.filename)")
                    try FileManager.default.moveItem(at: tempURL, to: localFile)
                    localFiles.append(localFile)
                }

                // 1b. Download assets
                var assetFiles: [String: String] = payload.files
                let sortedAssetKeys = payload.assets.keys.sorted()
                for (index, key) in sortedAssetKeys.enumerated() {
                    try Task.checkCancellation()
                    let asset = payload.assets[key]!
                    guard let url = URL(string: asset.url) else {
                        throw JobError.downloadFailed("Invalid URL for asset '\(key)': \(asset.url)")
                    }

                    let progress = videoCount + index
                    sendStatus(jobId: jobId, phase: "downloading", current: progress, total: totalDownloads,
                              message: "Downloading asset \(key) (\(progress + 1)/\(totalDownloads))")

                    let (tempURL, response) = try await URLSession.shared.download(from: url)

                    guard let httpResponse = response as? HTTPURLResponse,
                          (200...299).contains(httpResponse.statusCode) else {
                        throw JobError.downloadFailed("HTTP error downloading asset '\(key)'")
                    }

                    let localFile = tempDir.appendingPathComponent("asset_\(key)_\(asset.filename)")
                    try FileManager.default.moveItem(at: tempURL, to: localFile)
                    assetFiles[key] = localFile.path
                }

                sendStatus(jobId: jobId, phase: "downloading", current: totalDownloads, total: totalDownloads,
                          message: "Downloads complete")

                // 2. Render
                try Task.checkCancellation()
                let outputFile = jobFolder.appendingPathComponent("output.mp4")
                sendStatus(jobId: jobId, phase: "rendering", current: 0, total: 100,
                          message: "Rendering video…")

                let onProgress: @Sendable (Float) -> Void = { [weak self] progress in
                    let percent = Int(progress * 100)
                    Task { @MainActor in
                        self?.sendStatus(jobId: jobId, phase: "rendering", current: percent, total: 100,
                                        message: "Rendering video… \(percent)%")
                    }
                }

                if useTheme, let elements = payload.elements {
                    let videosMap = Dictionary(uniqueKeysWithValues: zip(sortedKeys, localFiles))
                    try await ThemeCompositionExporter.export(
                        elements: elements,
                        videos: videosMap,
                        files: assetFiles,
                        to: outputFile,
                        onProgress: onProgress
                    )
                } else {
                    try await CompositionExporter.export(
                        segments: localFiles,
                        to: outputFile,
                        onProgress: onProgress
                    )
                }

                sendStatus(jobId: jobId, phase: "rendering", current: 100, total: 100,
                          message: "Render complete")

                // 3. Upload via multipart POST
                try Task.checkCancellation()
                guard let callbackURL = URL(string: payload.callbackUrl) else {
                    throw JobError.validationFailed("Invalid callback URL: \(payload.callbackUrl)")
                }
                
                sendStatus(jobId: jobId, phase: "uploading", current: 0, total: 1,
                          message: "Uploading to server...")
                
                let fileData = try Data(contentsOf: outputFile)
                let boundary = UUID().uuidString
                var body = Data()
                body.append("--\(boundary)\r\n".data(using: .utf8)!)
                body.append("Content-Disposition: form-data; name=\"video\"; filename=\"output.mp4\"\r\n".data(using: .utf8)!)
                body.append("Content-Type: video/mp4\r\n\r\n".data(using: .utf8)!)
                body.append(fileData)
                body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
                
                var uploadReq = URLRequest(url: callbackURL)
                uploadReq.httpMethod = "POST"
                uploadReq.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
                
                let (uploadData, uploadResponse) = try await URLSession.shared.upload(for: uploadReq, from: body)
                
                guard let httpUpload = uploadResponse as? HTTPURLResponse,
                      (200...299).contains(httpUpload.statusCode) else {
                    let statusCode = (uploadResponse as? HTTPURLResponse)?.statusCode ?? -1
                    throw JobError.validationFailed("Upload failed with HTTP \(statusCode)")
                }
                
                var outputUrl = "http://127.0.0.1:63482/jobs/\(jobId)/output.mp4"
                if let json = try? JSONSerialization.jsonObject(with: uploadData) as? [String: Any],
                   let url = json["url"] as? String {
                    outputUrl = url
                }
                
                // 4. Cleanup
                try? FileManager.default.removeItem(at: tempDir)
                
                webSocketServer?.send(JobDoneMessage(jobId: jobId, outputUrl: outputUrl))
                lastRender = LastRender(startedAt: jobStartedAt, finishedAt: Date(), videoCount: videoCount, result: .success)
                
            } catch is CancellationError {
                webSocketServer?.send(JobCancelledMessage(jobId: jobId))
                lastRender = LastRender(startedAt: jobStartedAt, finishedAt: Date(), videoCount: videoCount, result: .cancelled)
            } catch let error as JobError {
                webSocketServer?.send(JobErrorMessage(jobId: jobId, code: error.code.rawValue, message: error.message))
                lastRender = LastRender(startedAt: jobStartedAt, finishedAt: Date(), videoCount: videoCount, result: .error(error.message))
            } catch {
                webSocketServer?.send(JobErrorMessage(jobId: jobId, code: JobErrorCode.unknown.rawValue, message: error.localizedDescription))
                lastRender = LastRender(startedAt: jobStartedAt, finishedAt: Date(), videoCount: videoCount, result: .error(error.localizedDescription))
            }
            
            currentJobId = nil
            renderTask = nil
            isWorking = false
        }
    }
    
    private func cancelJob(_ jobId: String) {
        guard currentJobId == jobId else { return }
        renderTask?.cancel()
    }
    
    // MARK: - Job Callbacks
    
    private func sendStatus(jobId: String, phase: String, current: Int, total: Int, message: String) {
        let msg = JobStatusMessage(jobId: jobId, phase: phase, current: current, total: total, message: message)
        webSocketServer?.send(msg)
    }
}
