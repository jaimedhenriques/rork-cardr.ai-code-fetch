import SwiftUI

struct RootView: View {
    @State private var session = SessionStore()

    var body: some View {
        Group {
            switch session.status {
            case .loading:
                ZStack {
                    Theme.background.ignoresSafeArea()
                    ProgressView().tint(Theme.primary)
                }
            case .signedOut:
                AuthView()
            case .signedIn:
                MainTabView(session: session)
            }
        }
        .environment(session)
        .task {
            if case .loading = session.status {
                await session.restore()
            }
        }
    }
}
