//
//  CleanupManager.swift
//  Clipisode
//

import Foundation

nonisolated(unsafe) enum CleanupManager {
    static let maxAge: TimeInterval = 30 * 24 * 60 * 60  // 30 days
    
    static func runOnLaunch() {
        Task.detached(priority: .background) {
            try? await cleanSources()
            try? await cleanJobs()
        }
    }
    
    private static func cleanSources() async throws {
        let fm = FileManager.default
        let cutoff = Date().addingTimeInterval(-maxAge)
        
        guard let files = try? fm.contentsOfDirectory(
            at: FileLocations.sourcesFolder,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else {
            return
        }
        
        for file in files {
            guard let attrs = try? file.resourceValues(forKeys: [.contentModificationDateKey]),
                  let modified = attrs.contentModificationDate,
                  modified < cutoff else {
                continue
            }
            
            try? fm.removeItem(at: file)
            print("Cleaned up old source: \(file.lastPathComponent)")
        }
    }
    
    private static func cleanJobs() async throws {
        let fm = FileManager.default
        let cutoff = Date().addingTimeInterval(-maxAge)
        
        guard let folders = try? fm.contentsOfDirectory(
            at: FileLocations.jobsFolder,
            includingPropertiesForKeys: [.contentModificationDateKey]
        ) else {
            return
        }
        
        for folder in folders {
            guard let attrs = try? folder.resourceValues(forKeys: [.contentModificationDateKey]),
                  let modified = attrs.contentModificationDate,
                  modified < cutoff else {
                continue
            }
            
            try? fm.removeItem(at: folder)
            print("Cleaned up old job: \(folder.lastPathComponent)")
        }
    }
}
