# Clipisode – Technical Architecture

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (localhost)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Clipisode Web UI                        │   │
│  │  - Job form (segments, times, order)                        │   │
│  │  - Progress display                                          │   │
│  │  - Video player                                              │   │
│  │  - localStorage for job state recovery                       │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │ WebSocket :63481              │ HTTP :63482
          │ (control, status)             │ (media files)
          ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Clipisode macOS App (Menu Bar)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ WebSocket    │  │ HTTP Server  │  │ Job Processor            │  │
│  │ Server       │  │              │  │  - DownloadManager       │  │
│  │ (NIOWebSocket│  │ (Swifter/    │  │  - FFmpegRunner          │  │
│  │  or URLSess.)│  │  NIO HTTP)   │  │  - FileManager           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Bundled Binaries: ffmpeg, ffprobe (optional)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      File System                                    │
│  ~/Library/Application Support/Clipisode/                          │
│    sources/           # Cached source files (shared)               │
│    jobs/<job_id>/     # Per-job output + metadata                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. macOS App Structure

### 2.1 Project Layout

```
Clipisode/
├── Clipisode.xcodeproj
├── Clipisode/
│   ├── App/
│   │   ├── ClipisodeApp.swift          # @main, menu bar setup
│   │   └── AppState.swift              # Global app state (ObservableObject)
│   │
│   ├── MenuBar/
│   │   ├── MenuBarView.swift           # SwiftUI menu content
│   │   └── StatusItemController.swift  # NSStatusItem management, icon states
│   │
│   ├── Servers/
│   │   ├── WebSocketServer.swift       # NIOWebSocket or URLSessionWebSocketTask
│   │   ├── HTTPServer.swift            # Static file server for /jobs/
│   │   └── MessageHandler.swift        # JSON encode/decode, routing
│   │
│   ├── Jobs/
│   │   ├── Job.swift                   # Job model (Codable)
│   │   ├── Segment.swift               # Segment model
│   │   ├── JobProcessor.swift          # Orchestrates download → trim → concat
│   │   ├── JobStore.swift              # In-memory job history (this session)
│   │   └── JobFileManager.swift        # Creates folders, writes job.json
│   │
│   ├── Download/
│   │   ├── DownloadManager.swift       # URLSession, 3 concurrent, 3 retries
│   │   ├── SourceCache.swift           # HEAD check, deduplication logic
│   │   └── DownloadTask.swift          # Per-file download state
│   │
│   ├── FFmpeg/
│   │   ├── FFmpegRunner.swift          # Process execution, stderr parsing
│   │   ├── FFprobeRunner.swift         # Optional duration validation
│   │   └── ConcatFileBuilder.swift     # Generates concat.txt
│   │
│   ├── Cleanup/
│   │   └── CleanupManager.swift        # 30-day purge on launch
│   │
│   ├── Models/
│   │   ├── Messages.swift              # WebSocket message types (Codable)
│   │   └── Errors.swift                # App error codes
│   │
│   └── Resources/
│       ├── ffmpeg                      # Bundled binary
│       └── ffprobe                     # Bundled binary (optional)
│
└── ClipisodeTests/
    └── ...
```

### 2.2 App Lifecycle

```swift
@main
struct ClipisodeApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        // Dropdown menu (standard menu style)
        MenuBarExtra {
            Text(appState.isWorking ? "Status: Working" : "Status: Idle")
            
            Divider()
            
            if !appState.completedJobs.isEmpty {
                Menu("Recent Jobs") {
                    ForEach(appState.completedJobs.prefix(5)) { job in
                        Button(job.id) {
                            NSWorkspace.shared.open(job.outputURL)
                        }
                    }
                }
            }
            
            Button("Open Output Folder") {
                NSWorkspace.shared.open(appState.jobsFolder)
            }
            
            Divider()
            
            SettingsLink {
                Text("Settings...")
            }
            
            Divider()
            
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("Q")
        } label: {
            Image(systemName: appState.isWorking ? "film.fill" : "film")
                .foregroundColor(appState.isWorking ? .green : .primary)
        }
        .menuBarExtraStyle(.menu)
        
        // Settings window (opens via SettingsLink)
        Settings {
            SettingsView()
                .environmentObject(appState)
        }
    }
}
```

### 2.3 SettingsView

```swift
struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Form {
            Section("Server") {
                // Future: port configuration
                LabeledContent("WebSocket Port", value: "63481")
                LabeledContent("HTTP Port", value: "63482")
            }
            
            Section("Storage") {
                LabeledContent("Output Folder") {
                    Button("Open") {
                        NSWorkspace.shared.open(appState.jobsFolder)
                    }
                }
                LabeledContent("Cache Size", value: appState.cacheSize)
                Button("Clear Cache...") {
                    // Show confirmation, then clear
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 250)
    }
}
```

### 2.4 AppState

```swift
@MainActor
class AppState: ObservableObject {
    @Published var isWorking = false
    @Published var currentJob: Job?
    @Published var completedJobs: [Job] = []  // This session only
    
    let webSocketServer: WebSocketServer
    let httpServer: HTTPServer
    let jobProcessor: JobProcessor
    
    init() {
        // Start servers, fail if ports in use
        // Run cleanup on launch
    }
}
```

---

## 3. WebSocket Server

### 3.1 Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **swift-nio + websocket-kit** | Full control, performant | More code, dependency |
| **Vapor (server mode)** | Batteries included | Heavy for menu bar app |
| **URLSessionWebSocketTask (client)** | Built-in | We need *server*, not client |
| **GCDAsyncSocket + manual WS** | No deps | Manual WebSocket framing |

**Recommendation**: `swift-nio` with `websocket-kit` — lightweight, well-maintained.

### 3.2 Connection Management

```swift
class WebSocketServer {
    private var activeConnection: WebSocketConnection?
    
    func handleNewConnection(_ ws: WebSocket) {
        if activeConnection != nil {
            // Reject: only one client allowed
            ws.send(ConnectionRejected(reason: "Another client is already connected"))
            ws.close()
            return
        }
        activeConnection = WebSocketConnection(ws)
        // Set up message handlers
    }
    
    func handleDisconnect() {
        activeConnection = nil
    }
}
```

### 3.3 Message Routing

```swift
struct MessageHandler {
    func handle(_ data: Data, connection: WebSocketConnection) {
        guard let message = try? JSONDecoder().decode(IncomingMessage.self, from: data) else {
            return // Invalid JSON, ignore
        }
        
        switch message.type {
        case "hello":
            connection.send(HelloAck(app: "Clipisode", version: 1))
        case "start_job":
            let job = try JSONDecoder().decode(StartJobMessage.self, from: data)
            jobProcessor.start(job)
        case "job_status_request":
            let request = try JSONDecoder().decode(JobStatusRequest.self, from: data)
            handleStatusRequest(request, connection)
        case "cancel_job":
            let cancel = try JSONDecoder().decode(CancelJob.self, from: data)
            jobProcessor.cancel(cancel.job_id)
        default:
            break
        }
    }
}
```

---

## 4. HTTP File Server

### 4.1 Route Structure

```
GET /jobs/<job_id>/output.mp4  →  ~/Library/.../jobs/<job_id>/output.mp4
```

### 4.2 Implementation

```swift
class HTTPServer {
    let basePath: URL  // ~/Library/Application Support/Clipisode/jobs
    
    func handleRequest(_ request: HTTPRequest) -> HTTPResponse {
        // Parse: /jobs/<job_id>/output.mp4
        guard let jobId = extractJobId(request.path),
              let filename = extractFilename(request.path) else {
            return HTTPResponse(status: .notFound)
        }
        
        let filePath = basePath
            .appendingPathComponent(jobId)
            .appendingPathComponent(filename)
        
        guard FileManager.default.fileExists(atPath: filePath.path) else {
            return HTTPResponse(status: .notFound)
        }
        
        // Serve with Range support for video seeking
        return serveFile(filePath, request: request)
    }
}
```

### 4.3 Range Request Support

Essential for HTML5 video seeking:

```swift
func serveFile(_ path: URL, request: HTTPRequest) -> HTTPResponse {
    let fileSize = getFileSize(path)
    
    if let rangeHeader = request.headers["Range"] {
        // Parse: bytes=0-1023
        let (start, end) = parseRange(rangeHeader, fileSize: fileSize)
        return HTTPResponse(
            status: .partialContent,
            headers: [
                "Content-Range": "bytes \(start)-\(end)/\(fileSize)",
                "Content-Length": "\(end - start + 1)",
                "Content-Type": "video/mp4",
                "Accept-Ranges": "bytes"
            ],
            body: readFileRange(path, start: start, end: end)
        )
    }
    
    return HTTPResponse(
        status: .ok,
        headers: [
            "Content-Length": "\(fileSize)",
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes"
        ],
        body: readFile(path)
    )
}
```

---

## 5. Job Processing Pipeline

### 5.1 JobProcessor

```swift
class JobProcessor {
    private var currentTask: Task<Void, Never>?
    
    func start(_ message: StartJobMessage) {
        guard currentTask == nil else {
            // Already processing, reject
            return
        }
        
        currentTask = Task {
            await process(message)
            currentTask = nil
        }
    }
    
    func cancel(_ jobId: String) {
        currentTask?.cancel()
        // Clean up, send job_cancelled
    }
    
    private func process(_ message: StartJobMessage) async {
        let job = Job(from: message)
        
        do {
            // 1. Create job folder
            let jobFolder = try JobFileManager.createJobFolder(job.id)
            
            // 2. Download sources
            sendStatus(job.id, phase: .downloading, current: 0, total: job.uniqueSourceCount)
            let sourceFiles = try await downloadSources(job, folder: jobFolder)
            
            // 3. Trim segments
            sendStatus(job.id, phase: .trimming, current: 0, total: job.segments.count)
            let segmentFiles = try await trimSegments(job, sources: sourceFiles, folder: jobFolder)
            
            // 4. Concatenate
            sendStatus(job.id, phase: .joining, current: 0, total: 1)
            let outputPath = try await concatenate(segmentFiles, folder: jobFolder)
            
            // 5. Cleanup temp
            try JobFileManager.deleteTemp(jobFolder)
            
            // 6. Write job.json
            try JobFileManager.writeJobJson(job, folder: jobFolder, state: .done)
            
            // 7. Notify
            sendJobDone(job.id, outputURL: outputPath)
            
        } catch is CancellationError {
            sendJobCancelled(job.id)
        } catch {
            sendJobError(job.id, error: error)
        }
    }
}
```

### 5.2 Download Phase

```swift
class DownloadManager {
    private let maxConcurrent = 3
    private let maxRetries = 3
    
    func downloadSources(_ urls: [URL], to folder: URL, 
                         onProgress: (Int, Int) -> Void) async throws -> [URL: URL] {
        var results: [URL: URL] = [:]
        
        try await withThrowingTaskGroup(of: (URL, URL).self) { group in
            var pending = urls.makeIterator()
            var inFlight = 0
            
            // Seed initial batch
            for _ in 0..<min(maxConcurrent, urls.count) {
                if let url = pending.next() {
                    group.addTask { try await self.download(url, to: folder) }
                    inFlight += 1
                }
            }
            
            // Process results, add more as slots free
            for try await (sourceURL, localPath) in group {
                results[sourceURL] = localPath
                onProgress(results.count, urls.count)
                
                if let url = pending.next() {
                    group.addTask { try await self.download(url, to: folder) }
                }
            }
        }
        
        return results
    }
    
    private func download(_ url: URL, to folder: URL) async throws -> (URL, URL) {
        // Check cache first
        if let cached = try await SourceCache.check(url) {
            return (url, cached)
        }
        
        // Download with retries
        var lastError: Error?
        for attempt in 1...maxRetries {
            do {
                let localPath = try await performDownload(url, to: folder)
                return (url, localPath)
            } catch {
                lastError = error
                if attempt < maxRetries {
                    try await Task.sleep(nanoseconds: UInt64(attempt) * 1_000_000_000) // Backoff
                }
            }
        }
        throw lastError ?? DownloadError.unknown
    }
}
```

### 5.3 Source Cache

```swift
class SourceCache {
    static let sourcesFolder: URL = // ~/Library/.../sources/
    
    static func check(_ url: URL) async throws -> URL? {
        // HEAD request for Content-Length
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              let contentLength = httpResponse.value(forHTTPHeaderField: "Content-Length"),
              let size = Int64(contentLength) else {
            return nil  // Can't determine size, will download
        }
        
        let cacheKey = "\(url.lastPathComponent)_\(size)"
        let cachedPath = sourcesFolder.appendingPathComponent(cacheKey)
        
        if FileManager.default.fileExists(atPath: cachedPath.path) {
            // Update access time for cleanup tracking
            try FileManager.default.setAttributes(
                [.modificationDate: Date()],
                ofItemAtPath: cachedPath.path
            )
            return cachedPath
        }
        
        return nil
    }
    
    static func store(_ tempFile: URL, for url: URL, size: Int64) throws -> URL {
        let cacheKey = "\(url.lastPathComponent)_\(size)"
        let cachedPath = sourcesFolder.appendingPathComponent(cacheKey)
        try FileManager.default.moveItem(at: tempFile, to: cachedPath)
        return cachedPath
    }
}
```

---

## 6. FFmpeg Integration

### 6.1 FFmpegRunner

```swift
class FFmpegRunner {
    static let binaryPath: URL = Bundle.main.url(forResource: "ffmpeg", withExtension: nil)!
    
    func trim(input: URL, start: Double, end: Double, output: URL) async throws {
        let args = [
            "-y",                           // Overwrite
            "-ss", String(start),           // Seek (before -i for fast seek)
            "-to", String(end),
            "-i", input.path,
            "-c:v", "libx264",              // Transcode video
            "-c:a", "aac",                  // Transcode audio
            "-avoid_negative_ts", "make_zero",
            output.path
        ]
        
        try await run(args)
    }
    
    func concat(segments: [URL], output: URL, tempFolder: URL) async throws {
        // Build concat.txt
        let concatFile = tempFolder.appendingPathComponent("concat.txt")
        let contents = segments.map { "file '\($0.path)'" }.joined(separator: "\n")
        try contents.write(to: concatFile, atomically: true, encoding: .utf8)
        
        let args = [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concatFile.path,
            "-c", "copy",                   // Stream copy (same codec)
            output.path
        ]
        
        try await run(args)
    }
    
    private func run(_ args: [String]) async throws {
        let process = Process()
        process.executableURL = Self.binaryPath
        process.arguments = args
        
        let stderrPipe = Pipe()
        process.standardError = stderrPipe
        
        try process.run()
        
        // Wait with cancellation support
        await withTaskCancellationHandler {
            process.waitUntilExit()
        } onCancel: {
            process.terminate()
        }
        
        guard process.terminationStatus == 0 else {
            let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)
            throw FFmpegError.failed(code: process.terminationStatus, message: stderr ?? "Unknown error")
        }
    }
}
```

### 6.2 FFprobeRunner (Optional)

```swift
class FFprobeRunner {
    static var isAvailable: Bool {
        Bundle.main.url(forResource: "ffprobe", withExtension: nil) != nil
    }
    
    static func getDuration(_ url: URL) async throws -> Double? {
        guard isAvailable else { return nil }
        
        let args = [
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            url.absoluteString
        ]
        
        let output = try await run(args)
        let json = try JSONDecoder().decode(FFprobeOutput.self, from: output)
        return Double(json.format.duration ?? "0")
    }
}
```

---

## 7. Cleanup Manager

```swift
class CleanupManager {
    static let maxAge: TimeInterval = 30 * 24 * 60 * 60  // 30 days
    
    static func runOnLaunch() {
        Task.detached(priority: .background) {
            try? await cleanSources()
            try? await cleanJobs()
        }
    }
    
    private static func cleanSources() async throws {
        let sourcesFolder = // ~/Library/.../sources/
        let cutoff = Date().addingTimeInterval(-maxAge)
        
        let files = try FileManager.default.contentsOfDirectory(
            at: sourcesFolder,
            includingPropertiesForKeys: [.contentModificationDateKey]
        )
        
        for file in files {
            let attrs = try file.resourceValues(forKeys: [.contentModificationDateKey])
            if let modified = attrs.contentModificationDate, modified < cutoff {
                try FileManager.default.removeItem(at: file)
            }
        }
    }
    
    private static func cleanJobs() async throws {
        // Similar logic for jobs folder
    }
}
```

---

## 8. Browser UI Architecture

### 8.1 File Structure

```
web/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js              # Main entry, state management
│   ├── websocket.js        # Connection handling, reconnect
│   ├── job-form.js         # Segment form logic
│   ├── progress.js         # Progress display
│   ├── player.js           # Video player controls
│   └── storage.js          # localStorage helpers
└── assets/
    └── ...
```

### 8.2 State Machine

```javascript
const AppState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    SUBMITTING: 'submitting',
    PROCESSING: 'processing',
    DONE: 'done',
    ERROR: 'error'
};

class App {
    constructor() {
        this.state = AppState.DISCONNECTED;
        this.currentJob = Storage.getActiveJob();
        this.ws = null;
    }
    
    async init() {
        this.setState(AppState.CONNECTING);
        
        try {
            await this.connect();
            this.setState(AppState.CONNECTED);
            
            // Check for pending job from localStorage
            if (this.currentJob) {
                this.ws.send({ type: 'job_status_request', job_id: this.currentJob.job_id });
            }
        } catch (e) {
            this.setState(AppState.DISCONNECTED);
        }
    }
}
```

### 8.3 WebSocket Client

```javascript
class WebSocketClient {
    constructor(url, handlers) {
        this.url = url;
        this.handlers = handlers;
        this.ws = null;
    }
    
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                this.send({ type: 'hello', client: 'clipisode-web', version: 1 });
            };
            
            this.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                
                switch (msg.type) {
                    case 'hello_ack':
                        resolve();
                        break;
                    case 'connection_rejected':
                        reject(new Error(msg.reason));
                        break;
                    case 'job_status':
                        this.handlers.onStatus(msg);
                        break;
                    case 'job_done':
                        this.handlers.onDone(msg);
                        break;
                    case 'job_error':
                        this.handlers.onError(msg);
                        break;
                    case 'job_cancelled':
                        this.handlers.onCancelled(msg);
                        break;
                    case 'job_not_found':
                        this.handlers.onNotFound(msg);
                        break;
                }
            };
            
            this.ws.onclose = () => {
                this.handlers.onDisconnect();
            };
        });
    }
    
    send(msg) {
        this.ws.send(JSON.stringify(msg));
    }
}
```

### 8.4 localStorage Schema

```javascript
// Key: 'clipisode_active_job'
{
    "job_id": "20260115T213045Z",
    "segments": [...],
    "state": "processing",
    "phase": "downloading",
    "current": 2,
    "total": 4,
    "submitted_at": "2026-01-15T21:30:45Z"
}
```

---

## 9. Error Handling

### 9.1 Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| `VALIDATION_FAILED` | Invalid input (times, URL) | "Invalid segment: end time must be after start time" |
| `DOWNLOAD_FAILED` | Source download failed after retries | "Failed to download: [filename]" |
| `FFMPEG_FAILED` | ffmpeg process error | "Video processing failed: [stderr excerpt]" |
| `PORT_IN_USE` | Server port unavailable | "Port 63481 is in use. Please close other applications." |
| `CANCELLED` | User cancelled job | "Job cancelled" |
| `UNKNOWN` | Unexpected error | "An unexpected error occurred" |

### 9.2 Error Recovery

- **Download failure**: Retry 3 times with exponential backoff
- **ffmpeg failure**: Preserve `temp/` folder for debugging
- **WebSocket disconnect**: Browser stores job state, requests status on reconnect
- **App crash**: Job folder persists, browser can detect incomplete job via `job_not_found`

---

## 10. Security Considerations

### 10.1 MVP Scope (Acceptable Risks)

- HTTP only (no TLS) — localhost traffic only
- No authentication — single user, local machine
- All job outputs exposed — acceptable for internal use

### 10.2 Future Hardening

- Bind to `127.0.0.1` only (no external access)
- Add session token for HTTP access
- Validate URLs against allowlist
- Rate limit WebSocket messages

---

## 11. Dependencies

### 11.1 Swift Packages

| Package | Purpose | Version |
|---------|---------|---------|
| `swift-nio` | Async networking | ~2.x |
| `websocket-kit` | WebSocket server | ~2.x |
| `swift-log` | Logging | ~1.x |

### 11.2 Bundled Binaries

| Binary | Source | License |
|--------|--------|---------|
| `ffmpeg` | Static build with x264/x265/aac | GPL (blocks App Store) |
| `ffprobe` | Same build (optional) | GPL |

Build source: https://evermeet.cx/ffmpeg/ or self-compiled

---

## 12. Build & Distribution

### 12.1 Xcode Project Settings

- **Deployment Target**: macOS 13.0+ (for MenuBarExtra)
- **Signing**: Developer ID (for direct distribution)
- **Hardened Runtime**: Yes
- **Entitlements**:
  - `com.apple.security.network.server` (for HTTP/WS servers)
  - `com.apple.security.network.client` (for downloads)

### 12.2 Binary Bundling

```
Clipisode.app/
└── Contents/
    ├── MacOS/
    │   └── Clipisode
    ├── Resources/
    │   ├── ffmpeg          # chmod +x, codesigned
    │   └── ffprobe         # chmod +x, codesigned (optional)
    └── Info.plist
```

### 12.3 Notarization

```bash
# Archive
xcodebuild archive -scheme Clipisode -archivePath Clipisode.xcarchive

# Export
xcodebuild -exportArchive -archivePath Clipisode.xcarchive \
  -exportPath ./dist -exportOptionsPlist ExportOptions.plist

# Notarize
xcrun notarytool submit dist/Clipisode.app --wait --apple-id ... --team-id ...

# Staple
xcrun stapler staple dist/Clipisode.app
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

- Message parsing/encoding
- Source cache key generation
- Validation rules
- Cleanup date logic

### 13.2 Integration Tests

- WebSocket handshake flow
- HTTP file serving with Range headers
- ffmpeg trim + concat pipeline

### 13.3 Manual Test Cases

- [ ] Submit job with 1 segment
- [ ] Submit job with 4 segments from 2 sources
- [ ] Cancel job mid-download
- [ ] Cancel job mid-transcode
- [ ] Reconnect browser mid-job
- [ ] Second browser tab rejected
- [ ] Invalid URL (not HTTPS)
- [ ] Invalid times (end < start)
- [ ] Large file (>1GB source)
- [ ] App quit and relaunch (cleanup runs)
