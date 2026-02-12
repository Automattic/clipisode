//
//  ClipisodeApp.swift
//  Clipisode
//

import SwiftUI

@main
struct ClipisodeApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        MenuBarExtra {
            Text(appState.isWorking ? "Status: Working" : "Status: Idle")
            
            Divider()
            
            if !appState.completedJobs.isEmpty {
                Menu("Recent Jobs") {
                    ForEach(appState.completedJobs) { job in
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
                .symbolRenderingMode(.palette)
                .foregroundStyle(appState.isWorking ? .green : .primary)
        }
        .menuBarExtraStyle(.menu)
        
        Settings {
            SettingsView(appState: appState)
        }
    }
}
