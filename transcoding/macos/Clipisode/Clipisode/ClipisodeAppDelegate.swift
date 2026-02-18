//
//  ClipisodeAppDelegate.swift
//  Clipisode
//

import AppKit

final class ClipisodeAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        runLaunchRender()
    }

    private func runLaunchRender() {
        guard let appState = AppStateHolder.shared else { return }

        let downloads = FileManager.default.homeDirectory(forUser: "max")!
            .appendingPathComponent("Downloads")

        let inputs: [URL] = [
            downloads.appendingPathComponent("one.mov"),
            downloads.appendingPathComponent("two.mov"),
            downloads.appendingPathComponent("three.mov"),
        ]
        let output = downloads.appendingPathComponent("out.mp4")

        Task { @MainActor in
            appState.runLocalJob(inputs: inputs, names: ["Max", "Brian", "Christoph"], output: output)
        }
    }
}
