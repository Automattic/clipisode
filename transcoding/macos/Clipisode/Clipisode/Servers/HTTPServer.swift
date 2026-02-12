//
//  HTTPServer.swift
//  Clipisode
//
//  Simple HTTP file server for serving job outputs with Range request support.
//

import Foundation
import Network

final class HTTPServer: @unchecked Sendable {
    private var listener: NWListener?
    private var basePath: URL?
    private let queue = DispatchQueue(label: "http-server")
    
    func start(port: UInt16, basePath: URL) throws {
        self.basePath = basePath
        
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        
        let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
        self.listener = listener
        
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                print("HTTP server listening on port \(port)")
            case .failed(let error):
                print("HTTP server failed: \(error)")
            default:
                break
            }
        }
        
        listener.newConnectionHandler = { [weak self] connection in
            self?.handleConnection(connection)
        }
        
        listener.start(queue: queue)
    }
    
    func stop() {
        listener?.cancel()
        listener = nil
    }
    
    private func handleConnection(_ connection: NWConnection) {
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                self?.readRequest(connection)
            default:
                break
            }
        }
        
        connection.start(queue: .global())
    }
    
    private func readRequest(_ connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, _, error in
            guard let self = self, let data = data, error == nil else {
                connection.cancel()
                return
            }
            self.handleRequest(connection, data: data)
        }
    }
    
    private func handleRequest(_ connection: NWConnection, data: Data) {
        guard let request = String(data: data, encoding: .utf8),
              let basePath = self.basePath else {
            sendError(connection, status: 400, message: "Bad Request")
            return
        }
        
        // Parse request line
        let lines = request.components(separatedBy: "\r\n")
        guard let firstLine = lines.first else {
            sendError(connection, status: 400, message: "Bad Request")
            return
        }
        
        let parts = firstLine.split(separator: " ")
        guard parts.count >= 2, parts[0] == "GET" else {
            sendError(connection, status: 405, message: "Method Not Allowed")
            return
        }
        
        let path = String(parts[1])
        
        // Parse headers
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            let headerParts = line.split(separator: ":", maxSplits: 1)
            if headerParts.count == 2 {
                let key = String(headerParts[0]).trimmingCharacters(in: .whitespaces).lowercased()
                let value = String(headerParts[1]).trimmingCharacters(in: .whitespaces)
                headers[key] = value
            }
        }
        
        // Expected path: /jobs/<job_id>/output.mp4
        guard path.hasPrefix("/jobs/") else {
            sendError(connection, status: 404, message: "Not Found")
            return
        }
        
        // Remove /jobs/ prefix and construct file path
        let relativePath = String(path.dropFirst(6)) // Remove "/jobs/"
        let filePath = basePath.appendingPathComponent(relativePath)
        
        // Security: ensure we're still within basePath
        guard filePath.path.hasPrefix(basePath.path) else {
            sendError(connection, status: 403, message: "Forbidden")
            return
        }
        
        // Check if file exists
        let fm = FileManager.default
        guard fm.fileExists(atPath: filePath.path) else {
            sendError(connection, status: 404, message: "Not Found")
            return
        }
        
        // Get file size
        guard let attrs = try? fm.attributesOfItem(atPath: filePath.path),
              let fileSize = attrs[.size] as? Int64 else {
            sendError(connection, status: 500, message: "Internal Server Error")
            return
        }
        
        // Handle Range request for video seeking
        if let rangeHeader = headers["range"] {
            servePartialContent(connection, filePath: filePath, fileSize: fileSize, rangeHeader: rangeHeader)
        } else {
            serveFullFile(connection, filePath: filePath, fileSize: fileSize)
        }
    }
    
    private func serveFullFile(_ connection: NWConnection, filePath: URL, fileSize: Int64) {
        let headers = "HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: \(fileSize)\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
        
        connection.send(content: headers.data(using: .utf8), completion: .contentProcessed { [weak self] _ in
            self?.streamFile(connection, filePath: filePath, start: 0, end: fileSize - 1)
        })
    }
    
    private func servePartialContent(_ connection: NWConnection, filePath: URL, fileSize: Int64, rangeHeader: String) {
        // Parse "bytes=start-end"
        guard rangeHeader.hasPrefix("bytes=") else {
            sendError(connection, status: 416, message: "Range Not Satisfiable")
            return
        }
        
        let rangeSpec = String(rangeHeader.dropFirst(6))
        let rangeParts = rangeSpec.split(separator: "-")
        
        var start: Int64 = 0
        var end: Int64 = fileSize - 1
        
        if rangeParts.count == 1 {
            // "start-" form
            if let s = Int64(rangeParts[0]) {
                start = s
            }
        } else if rangeParts.count == 2 {
            if !rangeParts[0].isEmpty, let s = Int64(rangeParts[0]) {
                start = s
            }
            if !rangeParts[1].isEmpty, let e = Int64(rangeParts[1]) {
                end = min(e, fileSize - 1)
            }
        }
        
        guard start <= end && start < fileSize else {
            sendError(connection, status: 416, message: "Range Not Satisfiable")
            return
        }
        
        let contentLength = end - start + 1
        
        let headers = "HTTP/1.1 206 Partial Content\r\nContent-Type: video/mp4\r\nContent-Length: \(contentLength)\r\nContent-Range: bytes \(start)-\(end)/\(fileSize)\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"
        
        connection.send(content: headers.data(using: .utf8), completion: .contentProcessed { [weak self] _ in
            self?.streamFile(connection, filePath: filePath, start: start, end: end)
        })
    }
    
    private func streamFile(_ connection: NWConnection, filePath: URL, start: Int64, end: Int64) {
        DispatchQueue.global().async {
            guard let fileHandle = try? FileHandle(forReadingFrom: filePath) else {
                connection.cancel()
                return
            }
            
            defer { try? fileHandle.close() }
            
            try? fileHandle.seek(toOffset: UInt64(start))
            
            let chunkSize = 65536
            var remaining = end - start + 1
            
            while remaining > 0 {
                let toRead = min(Int(remaining), chunkSize)
                guard let data = try? fileHandle.read(upToCount: toRead), !data.isEmpty else {
                    break
                }
                
                let semaphore = DispatchSemaphore(value: 0)
                connection.send(content: data, completion: .contentProcessed { _ in
                    semaphore.signal()
                })
                semaphore.wait()
                
                remaining -= Int64(data.count)
            }
            
            connection.cancel()
        }
    }
    
    private func sendError(_ connection: NWConnection, status: Int, message: String) {
        let response = "HTTP/1.1 \(status) \(message)\r\nContent-Type: text/plain\r\nContent-Length: \(message.count)\r\nConnection: close\r\n\r\n\(message)"
        
        connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
            connection.cancel()
        })
    }
}
