//
//  SettingsView.swift
//  Clipisode
//

import SwiftUI

struct SettingsView: View {
    let appState: AppState
    @State private var showClearConfirmation = false
    
    var body: some View {
        Form {
            Section("Server") {
                LabeledContent("WebSocket Port", value: "63481")
                LabeledContent("HTTP Port", value: "63482")
                
                if let error = appState.serverError {
                    Text(error)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
            
            Section("Storage") {
                LabeledContent("Output Folder") {
                    Button("Open in Finder") {
                        NSWorkspace.shared.open(appState.jobsFolder)
                    }
                }
                
                LabeledContent("Cache Size", value: appState.cacheSize)
                
                Button("Clear Cache...", role: .destructive) {
                    showClearConfirmation = true
                }
            }
        }
        .formStyle(.grouped)
        .frame(width: 400, height: 280)
        .confirmationDialog("Clear Cache?", isPresented: $showClearConfirmation) {
            Button("Clear", role: .destructive) {
                clearCache()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will delete all cached source files. Job outputs will not be affected.")
        }
    }
    
    private func clearCache() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: FileLocations.sourcesFolder, includingPropertiesForKeys: nil) else {
            return
        }
        
        for file in files {
            try? fm.removeItem(at: file)
        }
    }
}
