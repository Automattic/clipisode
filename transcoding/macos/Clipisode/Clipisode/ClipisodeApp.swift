import SwiftUI

@main
struct ClipisodeApp: App {
    @NSApplicationDelegateAdaptor(ClipisodeAppDelegate.self) private var appDelegate
    @State private var appState: AppState

    init() {
        let state = AppState()
        _appState = State(initialValue: state)
        AppStateHolder.shared = state
    }

    var body: some Scene {
        MenuBarExtra {
            SettingsView(appState: appState)
        } label: {
            Image(systemName: appState.isConnected ? "film.fill" : "film")
                .symbolRenderingMode(appState.isWorking ? .palette : .monochrome)
                .foregroundStyle(appState.isWorking ? .green : .primary)
                .symbolEffect(.pulse, isActive: appState.isWorking)
        }
        .menuBarExtraStyle(.window)
    }
}
