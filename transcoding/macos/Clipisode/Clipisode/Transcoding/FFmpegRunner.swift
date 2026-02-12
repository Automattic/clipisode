//
//  FFmpegRunner.swift
//  Clipisode
//

import Foundation

enum FFmpegRunner {
    
    static var binaryPath: URL? {
        Bundle.main.url(forResource: "ffmpeg", withExtension: nil)
    }
    
    /// Trim and transcode a video segment
    /// - Parameters:
    ///   - start: Start time in seconds, or nil for beginning
    ///   - end: End time in seconds, or nil for end of file
    static func trim(input: URL, start: Double?, end: Double?, output: URL) async throws {
        guard let ffmpeg = binaryPath else {
            throw JobError.ffmpegFailed("ffmpeg binary not found in app bundle")
        }
        
        var args = ["-y"]  // Overwrite output
        
        // Add seek if start specified
        if let start = start {
            args += ["-ss", String(format: "%.3f", start)]
        }
        
        args += ["-i", input.path]  // Input file
        
        // Add end time if specified (relative to input, so use -t for duration or -to for absolute)
        if let end = end {
            if let start = start {
                // Use duration (-t) when we also have a start time
                args += ["-t", String(format: "%.3f", end - start)]
            } else {
                // Use absolute time (-to) when no start time
                args += ["-to", String(format: "%.3f", end)]
            }
        }
        
        // Normalize all segments to same specs for reliable concatenation
        args += [
            // Video: scale to 1080p, pad for aspect ratio, normalize to 30fps
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30",
            "-r", "30",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",              // Ensure compatible pixel format
            // Audio: normalize to 48kHz stereo
            "-ar", "48000",
            "-ac", "2",
            "-c:a", "aac",
            "-b:a", "128k",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            output.path
        ]
        
        try await run(ffmpeg, args: args)
    }
    
    /// Concatenate multiple segments into one file
    static func concat(segments: [URL], output: URL, tempFolder: URL) async throws {
        guard let ffmpeg = binaryPath else {
            throw JobError.ffmpegFailed("ffmpeg binary not found in app bundle")
        }
        
        // Build concat list file
        let concatFile = tempFolder.appendingPathComponent("concat.txt")
        let contents = segments.map { "file '\($0.path)'" }.joined(separator: "\n")
        try contents.write(to: concatFile, atomically: true, encoding: .utf8)
        
        let args = [
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concatFile.path,
            "-c", "copy",                       // Stream copy (no re-encode)
            "-movflags", "+faststart",
            output.path
        ]
        
        try await run(ffmpeg, args: args)
    }
    
    private static func run(_ executable: URL, args: [String]) async throws {
        let process = Process()
        process.executableURL = executable
        process.arguments = args
        
        let stderrPipe = Pipe()
        process.standardError = stderrPipe
        process.standardOutput = FileHandle.nullDevice
        
        try process.run()
        
        // Wait with cancellation support
        await withTaskCancellationHandler {
            process.waitUntilExit()
        } onCancel: {
            process.terminate()
        }
        
        guard process.terminationStatus == 0 else {
            let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let stderr = String(data: stderrData, encoding: .utf8) ?? "Unknown error"
            
            // Print full stderr for debugging
            print("❌ FFmpeg stderr:\n\(stderr)")
            print("❌ FFmpeg exit code: \(process.terminationStatus)")
            print("❌ FFmpeg args: \(args)")
            
            // Extract last meaningful error line
            let errorLine = stderr
                .components(separatedBy: "\n")
                .filter { $0.contains("Error") || $0.contains("error") || $0.contains("No such") }
                .last ?? "ffmpeg failed with exit code \(process.terminationStatus)"
            
            throw JobError.ffmpegFailed(errorLine)
        }
    }
}

// MARK: - FFprobe Runner (Optional)

enum FFprobeRunner {
    
    static var binaryPath: URL? {
        Bundle.main.url(forResource: "ffprobe", withExtension: nil)
    }
    
    static var isAvailable: Bool {
        binaryPath != nil
    }
    
    /// Get duration of a video file in seconds
    static func getDuration(_ url: URL) async throws -> Double? {
        guard let ffprobe = binaryPath else {
            return nil
        }
        
        let args = [
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            url.path
        ]
        
        let process = Process()
        process.executableURL = ffprobe
        process.arguments = args
        
        let stdoutPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = FileHandle.nullDevice
        
        try process.run()
        process.waitUntilExit()
        
        guard process.terminationStatus == 0 else {
            return nil
        }
        
        let data = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        
        struct FFprobeOutput: Decodable {
            struct Format: Decodable {
                let duration: String?
            }
            let format: Format
        }
        
        guard let output = try? JSONDecoder().decode(FFprobeOutput.self, from: data),
              let durationStr = output.format.duration,
              let duration = Double(durationStr) else {
            return nil
        }
        
        return duration
    }
}
