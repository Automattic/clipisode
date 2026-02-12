//
//  WebSocketServer.swift
//  Clipisode
//
//  WebSocket server using Network framework with NWProtocolWebSocket.
//

import Foundation
import Network

final class WebSocketServer: @unchecked Sendable {
    private var listener: NWListener?
    private var activeConnection: NWConnection?
    private let queue = DispatchQueue(label: "websocket-server")
    
    var onMessage: ((Data) -> Void)?
    
    func start(port: UInt16) throws {
        // Create WebSocket parameters
        let wsOptions = NWProtocolWebSocket.Options()
        wsOptions.autoReplyPing = true
        
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        parameters.defaultProtocolStack.applicationProtocols.insert(wsOptions, at: 0)
        
        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            throw NSError(domain: "WebSocketServer", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid port"])
        }
        
        let listener = try NWListener(using: parameters, on: nwPort)
        self.listener = listener
        
        listener.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("✅ WebSocket server listening on port \(port)")
            case .failed(let error):
                print("❌ WebSocket server failed: \(error)")
                self?.listener = nil
            case .cancelled:
                print("⚠️ WebSocket server cancelled")
            default:
                break
            }
        }
        
        listener.newConnectionHandler = { [weak self] connection in
            self?.handleNewConnection(connection)
        }
        
        listener.start(queue: queue)
    }
    
    func stop() {
        listener?.cancel()
        listener = nil
        activeConnection?.cancel()
        activeConnection = nil
    }
    
    private func handleNewConnection(_ connection: NWConnection) {
        print("📥 New WebSocket connection attempt")
        
        if activeConnection != nil {
            // Reject: only one connection allowed
            print("⚠️ Rejecting connection - already have active client")
            connection.cancel()
            return
        }
        
        activeConnection = connection
        
        connection.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready:
                print("✅ WebSocket connection ready")
                self?.receiveMessage(connection)
            case .failed(let error):
                print("❌ WebSocket connection failed: \(error)")
                self?.activeConnection = nil
            case .cancelled:
                print("⚠️ WebSocket connection cancelled")
                self?.activeConnection = nil
            default:
                break
            }
        }
        
        connection.start(queue: queue)
    }
    
    private func receiveMessage(_ connection: NWConnection) {
        connection.receiveMessage { [weak self] content, context, isComplete, error in
            if let error = error {
                print("❌ Receive error: \(error)")
                return
            }
            
            // Check if this is a WebSocket message
            if let context = context,
               let metadata = context.protocolMetadata(definition: NWProtocolWebSocket.definition) as? NWProtocolWebSocket.Metadata {
                
                switch metadata.opcode {
                case .text, .binary:
                    if let data = content {
                        print("📨 Received message: \(String(data: data, encoding: .utf8) ?? "binary")")
                        self?.onMessage?(data)
                    }
                case .close:
                    print("👋 Client sent close frame")
                    self?.activeConnection = nil
                    return
                default:
                    break
                }
            }
            
            // Continue receiving
            self?.receiveMessage(connection)
        }
    }
    
    func send<T: OutgoingMessage>(_ message: T) {
        guard let connection = activeConnection else {
            print("⚠️ No active connection to send message")
            return
        }
        
        guard let jsonData = try? JSONEncoder().encode(message) else {
            print("❌ Failed to encode message")
            return
        }
        
        let metadata = NWProtocolWebSocket.Metadata(opcode: .text)
        let context = NWConnection.ContentContext(identifier: "text", metadata: [metadata])
        
        connection.send(content: jsonData, contentContext: context, isComplete: true, completion: .contentProcessed { error in
            if let error = error {
                print("❌ Send error: \(error)")
            } else {
                print("📤 Sent: \(String(data: jsonData, encoding: .utf8) ?? "?")")
            }
        })
    }
}
