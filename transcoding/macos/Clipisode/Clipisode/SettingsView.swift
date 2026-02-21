//
//  SettingsView.swift
//  Clipisode
//

import SwiftUI
import ServiceManagement

struct SettingsView: View {
    let appState: AppState
    @State private var showClearConfirmation = false
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled
    
    var body: some View {
        VStack(spacing: 0) {
            Form {
                Section("General") {
                    Toggle("Launch at Login", isOn: $launchAtLogin)
                        .onChange(of: launchAtLogin) { _, newValue in
                            do {
                                if newValue {
                                    try SMAppService.mainApp.register()
                                } else {
                                    try SMAppService.mainApp.unregister()
                                }
                            } catch {
                                launchAtLogin = SMAppService.mainApp.status == .enabled
                            }
                        }
                }
                
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
            
            Divider()
            
            Button("Quit Clipisode") {
                NSApplication.shared.terminate(nil)
            }
            .keyboardShortcut("q")
            .padding(.vertical, 8)
        }
        .frame(width: 320)
        .fixedSize(horizontal: false, vertical: true)
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
