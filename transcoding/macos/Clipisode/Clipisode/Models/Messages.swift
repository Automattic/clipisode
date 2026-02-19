//
//  Messages.swift
//  Clipisode
//

import Foundation

// MARK: - Video Input

struct VideoInput: Decodable {
    let url: String
    let filename: String
}

// MARK: - Incoming Messages (Client → App)

struct IncomingMessage: Decodable {
    let type: String
}

struct HelloMessage: Decodable {
    let type: String
    let client: String
    let version: Int
}

struct StartJobMessage: Decodable {
    let type: String
    let jobId: String
    let callbackUrl: String
    let videos: [String: VideoInput]
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
        case callbackUrl = "callback_url"
        case videos
    }
}

struct JobStatusRequest: Decodable {
    let type: String
    let jobId: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
    }
}

struct CancelJobMessage: Decodable {
    let type: String
    let jobId: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
    }
}

// MARK: - Outgoing Messages (App → Client)

protocol OutgoingMessage: Encodable {
    var type: String { get }
}

struct HelloAck: OutgoingMessage {
    let type = "hello_ack"
    let app = "Clipisode"
    let version = 1
}

struct ConnectionRejected: OutgoingMessage {
    let type = "connection_rejected"
    let reason: String
}

struct JobStatusMessage: OutgoingMessage {
    let type = "job_status"
    let jobId: String
    let phase: String
    let current: Int
    let total: Int
    let message: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
        case phase, current, total, message
    }
}

struct JobDoneMessage: OutgoingMessage {
    let type = "job_done"
    let jobId: String
    let outputUrl: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
        case outputUrl = "output_url"
    }
}

struct JobErrorMessage: OutgoingMessage {
    let type = "job_error"
    let jobId: String
    let code: String
    let message: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
        case code, message
    }
}

struct JobNotFoundMessage: OutgoingMessage {
    let type = "job_not_found"
    let jobId: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
    }
}

struct JobCancelledMessage: OutgoingMessage {
    let type = "job_cancelled"
    let jobId: String
    
    enum CodingKeys: String, CodingKey {
        case type
        case jobId = "job_id"
    }
}

// MARK: - Error Codes

enum JobErrorCode: String {
    case validationFailed = "VALIDATION_FAILED"
    case downloadFailed = "DOWNLOAD_FAILED"
    case ffmpegFailed = "FFMPEG_FAILED"
    case portInUse = "PORT_IN_USE"
    case cancelled = "CANCELLED"
    case unknown = "UNKNOWN"
}
