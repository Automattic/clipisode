//
//  Job.swift
//  Clipisode
//

import Foundation

enum JobState: String, Codable {
    case pending
    case downloading
    case trimming
    case joining
    case done
    case error
    case cancelled
}

struct Job: Identifiable, Codable, Sendable {
    let id: String
    let segments: [Segment]
    var state: JobState
    var startedAt: Date
    var completedAt: Date?
    var error: String?
    
    var durationSeconds: Int? {
        guard let completed = completedAt else { return nil }
        return Int(completed.timeIntervalSince(startedAt))
    }
    
    var outputURL: URL {
        FileLocations.jobFolder(id).appendingPathComponent("output.mp4")
    }
    
    var uniqueSourceURLs: [URL] {
        var seen = Set<String>()
        return segments.compactMap { seg -> URL? in
            guard !seen.contains(seg.url), let url = seg.sourceURL else { return nil }
            seen.insert(seg.url)
            return url
        }
    }
    
    init(id: String, segments: [Segment]) {
        self.id = id
        self.segments = segments.sorted { $0.order < $1.order }
        self.state = .pending
        self.startedAt = Date()
    }
}

// MARK: - File Locations

nonisolated enum FileLocations {
    static var appSupport: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("Clipisode", isDirectory: true)
    }
    
    static var sourcesFolder: URL {
        appSupport.appendingPathComponent("sources", isDirectory: true)
    }
    
    static var jobsFolder: URL {
        appSupport.appendingPathComponent("jobs", isDirectory: true)
    }
    
    static func jobFolder(_ jobId: String) -> URL {
        jobsFolder.appendingPathComponent(jobId, isDirectory: true)
    }
    
    static func tempFolder(_ jobId: String) -> URL {
        jobFolder(jobId).appendingPathComponent("temp", isDirectory: true)
    }
    
    static func ensureDirectoriesExist() throws {
        let fm = FileManager.default
        try fm.createDirectory(at: sourcesFolder, withIntermediateDirectories: true)
        try fm.createDirectory(at: jobsFolder, withIntermediateDirectories: true)
    }
}

// MARK: - Job JSON Persistence

struct JobRecord: Codable {
    let jobId: String
    let segments: [Segment]
    let state: String
    let startedAt: String
    let completedAt: String?
    let durationSeconds: Int?
    let error: String?
    
    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case segments
        case state
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case durationSeconds = "duration_seconds"
        case error
    }
    
    init(from job: Job) {
        let formatter = ISO8601DateFormatter()
        self.jobId = job.id
        self.segments = job.segments
        self.state = job.state.rawValue
        self.startedAt = formatter.string(from: job.startedAt)
        self.completedAt = job.completedAt.map { formatter.string(from: $0) }
        self.durationSeconds = job.durationSeconds
        self.error = job.error
    }
    
    func write(to folder: URL) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(self)
        let path = folder.appendingPathComponent("job.json")
        try data.write(to: path)
    }
}
