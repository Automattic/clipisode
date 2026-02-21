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
                
                if let render = appState.lastRender {
                    Section("Last Render") {
                        LabeledContent("Status") {
                            switch render.result {
                            case .success:
                                Text("Success")
                                    .foregroundStyle(.green)
                            case .error(let message):
                                Text(message)
                                    .foregroundStyle(.red)
                                    .lineLimit(2)
                            case .cancelled:
                                Text("Cancelled")
                                    .foregroundStyle(.orange)
                            }
                        }
                        LabeledContent("Videos", value: "\(render.videoCount)")
                        LabeledContent("Duration", value: formatDuration(render.duration))
                        LabeledContent("Completed", value: render.finishedAt.formatted(.relative(presentation: .named)))
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
    
    private func formatDuration(_ seconds: TimeInterval) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = seconds >= 3600 ? [.hour, .minute, .second] : [.minute, .second]
        formatter.unitsStyle = .abbreviated
        formatter.zeroFormattingBehavior = .pad
        return formatter.string(from: seconds) ?? "\(Int(seconds))s"
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
