//
//  AppState.swift
//  Clipisode
//

import Foundation
import SwiftUI
import Observation
import CoreImage

/// Shared reference so the app delegate can run the launch render.
enum AppStateHolder {
    static weak var shared: AppState?
}

@Observable
@MainActor
final class AppState {
    var isWorking = false
    var currentJob: Job?
    var completedJobs: [Job] = []
    var serverError: String?
    
    private var webSocketServer: WebSocketServer?
    private var httpServer: HTTPServer?
    private var jobProcessor: JobProcessor?
    
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
        let processor = JobProcessor()
        
        self.webSocketServer = ws
        self.httpServer = http
        self.jobProcessor = processor
        
        // Connect components
        ws.onMessage = { [weak self] message in
            Task { @MainActor in
                self?.handleMessage(message)
            }
        }
        
        processor.onStatusUpdate = { [weak self] jobId, phase, current, total, message in
            Task { @MainActor in
                self?.sendStatus(jobId: jobId, phase: phase, current: current, total: total, message: message)
            }
        }
        
        processor.onComplete = { [weak self] job in
            Task { @MainActor in
                self?.handleJobComplete(job)
            }
        }
        
        processor.onError = { [weak self] jobId, code, message in
            Task { @MainActor in
                self?.handleJobError(jobId: jobId, code: code, message: message)
            }
        }
        
        processor.onCancelled = { [weak self] jobId in
            Task { @MainActor in
                self?.handleJobCancelled(jobId: jobId)
            }
        }
        
        // Start servers
        do {
            try ws.start(port: 63481)
            try http.start(port: 63482, basePath: FileLocations.jobsFolder)
        } catch {
            self.serverError = error.localizedDescription
        }
    }
    
    // MARK: - Message Handling
    
    private func handleMessage(_ data: Data) {
        // Try the simple render request format first (no "type" field)
        if let renderReq = try? JSONDecoder().decode(RenderRequest.self, from: data),
           !renderReq.videos.isEmpty {
            handleRenderRequest(renderReq)
            return
        }

        guard let base = try? JSONDecoder().decode(IncomingMessage.self, from: data) else {
            return
        }
        
        switch base.type {
        case "hello":
            let ack = HelloAck()
            webSocketServer?.send(ack)
            
        case "start_job":
            do {
                let msg = try JSONDecoder().decode(StartJobMessage.self, from: data)
                startJob(msg)
            } catch {
                print("❌ Failed to decode start_job: \(error)")
            }
            
        case "job_status_request":
            guard let msg = try? JSONDecoder().decode(JobStatusRequest.self, from: data) else { return }
            handleStatusRequest(msg.jobId)
            
        case "cancel_job":
            guard let msg = try? JSONDecoder().decode(CancelJobMessage.self, from: data) else { return }
            cancelJob(msg.jobId)
            
        default:
            break
        }
    }
    
    // MARK: - Render Request Handling
    
    private func handleRenderRequest(_ request: RenderRequest) {
        guard !isWorking else {
            print("⚠️ Already working, ignoring render request")
            return
        }
        isWorking = true
        
        let videoCount = request.videos.count
        print("📥 Render request received: \(videoCount) video(s), callback: \(request.callbackUrl)")
        
        Task {
            do {
                let jobId = UUID().uuidString
                let tempDir = FileLocations.tempFolder(jobId)
                let jobFolder = FileLocations.jobFolder(jobId)
                try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
                try FileManager.default.createDirectory(at: jobFolder, withIntermediateDirectories: true)
                
                // 1. Download all videos to temp files
                let sortedKeys = request.videos.keys.sorted()
                var localFiles: [URL] = []
                for (index, key) in sortedKeys.enumerated() {
                    let video = request.videos[key]!
                    guard let url = URL(string: video.url) else {
                        throw JobError.downloadFailed("Invalid URL for video '\(key)': \(video.url)")
                    }
                    
                    print("⬇️  Downloading [\(key)] (\(index + 1)/\(videoCount))...")
                    let (tempURL, response) = try await URLSession.shared.download(from: url)
                    
                    guard let httpResponse = response as? HTTPURLResponse,
                          (200...299).contains(httpResponse.statusCode) else {
                        throw JobError.downloadFailed("HTTP error downloading '\(key)'")
                    }
                    
                    let localFile = tempDir.appendingPathComponent("\(key)_\(video.filename)")
                    try FileManager.default.moveItem(at: tempURL, to: localFile)
                    localFiles.append(localFile)
                    print("✅ Downloaded [\(key)] → \(localFile.lastPathComponent)")
                }
                
                // 2. Render final video
                let outputFile = jobFolder.appendingPathComponent("output.mp4")
                print("🎬 Rendering \(localFiles.count) video(s) → \(outputFile.path)")
                
                try await CompositionExporter.export(
                    segments: localFiles,
                    to: outputFile
                )
                
                print("✅ Render complete: \(outputFile.path)")
                
                // 3. Upload to callback URL
                guard let callbackURL = URL(string: request.callbackUrl) else {
                    throw JobError.validationFailed("Invalid callback URL: \(request.callbackUrl)")
                }
                
                print("⬆️  Uploading to \(request.callbackUrl)...")
                let fileData = try Data(contentsOf: outputFile)
                var uploadRequest = URLRequest(url: callbackURL)
                uploadRequest.httpMethod = "PUT"
                uploadRequest.setValue("video/mp4", forHTTPHeaderField: "Content-Type")
                uploadRequest.setValue("\(fileData.count)", forHTTPHeaderField: "Content-Length")
                
                let (_, uploadResponse) = try await URLSession.shared.upload(for: uploadRequest, from: fileData)
                
                guard let httpUpload = uploadResponse as? HTTPURLResponse,
                      (200...299).contains(httpUpload.statusCode) else {
                    let statusCode = (uploadResponse as? HTTPURLResponse)?.statusCode ?? -1
                    throw JobError.validationFailed("Upload failed with HTTP \(statusCode)")
                }
                
                print("✅ Upload complete (HTTP \((uploadResponse as! HTTPURLResponse).statusCode))")
                
                // 4. Cleanup temp files
                try? FileManager.default.removeItem(at: tempDir)
                
                print("📂 Output path: \(outputFile.path)")
                
            } catch {
                print("❌ Render request failed: \(error.localizedDescription)")
            }
            
            isWorking = false
        }
    }
    
    private func startJob(_ msg: StartJobMessage) {
        print("🚀 startJob called with jobId: \(msg.jobId), segments: \(msg.segments.count)")
        guard currentJob == nil else {
            print("⚠️ Already have a current job, ignoring")
            return
        }
        
        let job = Job(id: msg.jobId, segments: msg.segments)
        currentJob = job
        isWorking = true
        
        print("📋 Starting job processor...")
        jobProcessor?.process(job)
    }
    
    private func handleStatusRequest(_ jobId: String) {
        if let job = currentJob, job.id == jobId {
            sendStatus(jobId: jobId, phase: job.state.rawValue, current: 0, total: 1, message: "Processing...")
        } else {
            let msg = JobNotFoundMessage(jobId: jobId)
            webSocketServer?.send(msg)
        }
    }
    
    private func cancelJob(_ jobId: String) {
        guard let job = currentJob, job.id == jobId else { return }
        jobProcessor?.cancel()
    }
    
    // MARK: - Job Callbacks
    
    private func sendStatus(jobId: String, phase: String, current: Int, total: Int, message: String) {
        let msg = JobStatusMessage(jobId: jobId, phase: phase, current: current, total: total, message: message)
        webSocketServer?.send(msg)
    }
    
    private func handleJobComplete(_ job: Job) {
        var completed = job
        completed.state = .done
        completed.completedAt = Date()
        
        completedJobs.insert(completed, at: 0)
        if completedJobs.count > 10 {
            completedJobs = Array(completedJobs.prefix(10))
        }
        
        let outputUrl = "http://127.0.0.1:63482/jobs/\(job.id)/output.mp4"
        let msg = JobDoneMessage(jobId: job.id, outputUrl: outputUrl)
        webSocketServer?.send(msg)
        
        currentJob = nil
        isWorking = false
    }
    
    private func handleJobError(jobId: String, code: JobErrorCode, message: String) {
        let msg = JobErrorMessage(jobId: jobId, code: code.rawValue, message: message)
        webSocketServer?.send(msg)
        
        currentJob = nil
        isWorking = false
    }
    
    private func handleJobCancelled(jobId: String) {
        let msg = JobCancelledMessage(jobId: jobId)
        webSocketServer?.send(msg)
        
        currentJob = nil
        isWorking = false
    }
}
