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
        MenuBarExtra(
            "Menu Bar Example",
            systemImage: "characters.uppercase"
        ) {
            SettingsView(appState: appState)
                .frame(width: 300, height: 180)
        }
        .menuBarExtraStyle(.menu)
    }
}
