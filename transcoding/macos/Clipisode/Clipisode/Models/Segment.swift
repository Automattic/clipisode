//
//  Segment.swift
//  Clipisode
//

import Foundation

struct Segment: Codable, Identifiable, Sendable {
    let url: String
    let start: Double?  // nil = from beginning
    let end: Double?    // nil = to end
    let order: Int
    
    var id: Int { order }
    
    var sourceURL: URL? {
        URL(string: url)
    }
    
    /// Whether this segment needs trimming (has explicit start or end)
    var needsTrimming: Bool {
        start != nil || end != nil
    }
}
