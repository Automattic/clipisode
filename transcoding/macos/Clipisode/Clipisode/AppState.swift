//
//  AppState.swift
//  Clipisode
//

import Foundation
import SwiftUI
import Observation

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
                
                // Trim / normalise each input (no start/end = full clip)
                var segmentFiles: [URL] = []
                for (index, input) in inputs.enumerated() {
                    let segmentFile = tempFolder.appendingPathComponent(
                        "segment_\(String(format: "%02d", index + 1)).mp4"
                    )
                    try await FFmpegRunner.trim(input: input, start: nil, end: nil, output: segmentFile)
                    segmentFiles.append(segmentFile)
                }
                
                // Compose segments with crossfade transitions and name overlays
                try await CompositionExporter.export(segments: segmentFiles, names: names, to: output)
                
                // Tidy up scratch files
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
