//
//  JobProcessor.swift
//  Clipisode
//

import Foundation

final class JobProcessor: @unchecked Sendable {
    private var currentTask: Task<Void, Never>?
    private var isCancelled = false
    
    var onStatusUpdate: ((String, String, Int, Int, String) -> Void)?
    var onComplete: ((Job) -> Void)?
    var onError: ((String, JobErrorCode, String) -> Void)?
    var onCancelled: ((String) -> Void)?
    
    func process(_ job: Job) {
        print("🔧 JobProcessor.process called for job: \(job.id)")
        isCancelled = false
        
        currentTask = Task {
            print("🔧 Task started for job: \(job.id)")
            await runJob(job)
        }
    }
    
    func cancel() {
        isCancelled = true
        currentTask?.cancel()
    }
    
    private func runJob(_ job: Job) async {
        print("🏃 runJob started for: \(job.id)")
        do {
            // 1. Create job folder
            let jobFolder = FileLocations.jobFolder(job.id)
            let tempFolder = FileLocations.tempFolder(job.id)
            print("📁 Creating folders: \(jobFolder.path)")
            try FileManager.default.createDirectory(at: jobFolder, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: tempFolder, withIntermediateDirectories: true)
            print("📁 Folders created successfully")
            
            // 2. Download sources
            let uniqueURLs = job.uniqueSourceURLs
            sendStatus(job.id, phase: "downloading", current: 0, total: uniqueURLs.count, message: "Starting downloads...")
            
            var sourceMap: [String: URL] = [:] // URL string -> local file
            
            for (index, url) in uniqueURLs.enumerated() {
                try Task.checkCancellation()
                
                sendStatus(job.id, phase: "downloading", current: index, total: uniqueURLs.count,
                          message: "Downloading file \(index + 1) of \(uniqueURLs.count)")
                
                let localPath = try await downloadSource(url)
                sourceMap[url.absoluteString] = localPath
            }
            
            sendStatus(job.id, phase: "downloading", current: uniqueURLs.count, total: uniqueURLs.count,
                      message: "Downloads complete")
            
            // 3. Trim segments
            let sortedSegments = job.segments.sorted { $0.order < $1.order }
            var segmentFiles: [URL] = []
            
            for (index, segment) in sortedSegments.enumerated() {
                try Task.checkCancellation()
                
                sendStatus(job.id, phase: "trimming", current: index, total: sortedSegments.count,
                          message: "Trimming segment \(index + 1) of \(sortedSegments.count)")
                
                guard let sourceFile = sourceMap[segment.url] else {
                    throw JobError.downloadFailed("Source file not found for \(segment.url)")
                }
                
                let segmentFile = tempFolder.appendingPathComponent("segment_\(String(format: "%02d", index + 1)).mp4")
                
                try await FFmpegRunner.trim(
                    input: sourceFile,
                    start: segment.start,  // nil = from beginning
                    end: segment.end,      // nil = to end
                    output: segmentFile
                )
                
                segmentFiles.append(segmentFile)
            }
            
            sendStatus(job.id, phase: "trimming", current: sortedSegments.count, total: sortedSegments.count,
                      message: "Trimming complete")
            
            // 4. Concatenate
            try Task.checkCancellation()
            
            sendStatus(job.id, phase: "joining", current: 0, total: 1, message: "Joining segments...")
            
            let outputFile = jobFolder.appendingPathComponent("output.mp4")
            try await FFmpegRunner.concat(segments: segmentFiles, output: outputFile, tempFolder: tempFolder)
            
            sendStatus(job.id, phase: "joining", current: 1, total: 1, message: "Join complete")
            
            // 5. Cleanup temp folder
            try? FileManager.default.removeItem(at: tempFolder)
            
            // 6. Write job.json
            var completedJob = job
            completedJob.state = .done
            completedJob.completedAt = Date()
            let record = JobRecord(from: completedJob)
            try record.write(to: jobFolder)
            
            // 7. Notify completion
            await MainActor.run {
                onComplete?(completedJob)
            }
            
        } catch is CancellationError {
            await MainActor.run {
                onCancelled?(job.id)
            }
        } catch let error as JobError {
            await MainActor.run {
                onError?(job.id, error.code, error.message)
            }
        } catch {
            await MainActor.run {
                onError?(job.id, .unknown, error.localizedDescription)
            }
        }
    }
    
    private func downloadSource(_ url: URL) async throws -> URL {
        // Check cache first
        if let cached = try await SourceCache.check(url) {
            return cached
        }
        
        // Download with retries
        let maxRetries = 3
        var lastError: Error?
        
        for attempt in 1...maxRetries {
            do {
                return try await performDownload(url)
            } catch {
                lastError = error
                if attempt < maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000)
                }
            }
        }
        
        throw JobError.downloadFailed(lastError?.localizedDescription ?? "Download failed")
    }
    
    private func performDownload(_ url: URL) async throws -> URL {
        let (tempURL, response) = try await URLSession.shared.download(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw JobError.downloadFailed("HTTP error")
        }
        
        // Get file size for cache key
        let size = httpResponse.expectedContentLength
        
        // Move to cache
        return try SourceCache.store(tempURL, for: url, size: size)
    }
    
    private func sendStatus(_ jobId: String, phase: String, current: Int, total: Int, message: String) {
        Task { @MainActor in
            onStatusUpdate?(jobId, phase, current, total, message)
        }
    }
}

// MARK: - Job Errors

enum JobError: Error {
    case validationFailed(String)
    case downloadFailed(String)
    case ffmpegFailed(String)
    
    var code: JobErrorCode {
        switch self {
        case .validationFailed: return .validationFailed
        case .downloadFailed: return .downloadFailed
        case .ffmpegFailed: return .ffmpegFailed
        }
    }
    
    var message: String {
        switch self {
        case .validationFailed(let msg): return msg
        case .downloadFailed(let msg): return msg
        case .ffmpegFailed(let msg): return msg
        }
    }
}

// MARK: - Source Cache

enum SourceCache {
    static func check(_ url: URL) async throws -> URL? {
        // HEAD request for Content-Length
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              let contentLength = httpResponse.value(forHTTPHeaderField: "Content-Length"),
              let size = Int64(contentLength) else {
            return nil
        }
        
        let cacheKey = "\(url.lastPathComponent)_\(size)"
        let cachedPath = FileLocations.sourcesFolder.appendingPathComponent(cacheKey)
        
        if FileManager.default.fileExists(atPath: cachedPath.path) {
            // Update modification time
            try? FileManager.default.setAttributes(
                [.modificationDate: Date()],
                ofItemAtPath: cachedPath.path
            )
            return cachedPath
        }
        
        return nil
    }
    
    static func store(_ tempFile: URL, for url: URL, size: Int64) throws -> URL {
        let cacheKey = "\(url.lastPathComponent)_\(size)"
        let cachedPath = FileLocations.sourcesFolder.appendingPathComponent(cacheKey)
        
        // Remove existing file if any
        try? FileManager.default.removeItem(at: cachedPath)
        
        // Move temp file to cache
        try FileManager.default.moveItem(at: tempFile, to: cachedPath)
        
        return cachedPath
    }
}
