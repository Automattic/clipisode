//
//  ClipisodeAppDelegate.swift
//  Clipisode
//

import AppKit

final class ClipisodeAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        print("🎬 Clipisode launched — waiting for WebSocket render request")
    }
}
