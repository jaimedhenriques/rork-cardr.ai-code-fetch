import SwiftUI

struct AuthView: View {
    @Environment(SessionStore.self) private var session

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var showResetSent = false

    enum Mode {
        case signIn, signUp

        var title: String { self == .signIn ? "Welcome back" : "Create your account" }
        var cta: String { self == .signIn ? "Sign in" : "Sign up" }
        var toggle: String { self == .signIn ? "New here? Create an account" : "Already have an account? Sign in" }
    }

    private var canSubmit: Bool {
        email.contains("@") && password.count >= 6 && !session.isSubmitting
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            backgroundGlow

            ScrollView {
                VStack(spacing: 28) {
                    Spacer(minLength: 40)
                    brand
                    formCard
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: .infinity)
            }
        }
        .alert("Check your inbox", isPresented: $showResetSent) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("If an account exists for \(email), a password reset link is on its way.")
        }
    }

    private var backgroundGlow: some View {
        Circle()
            .fill(Theme.brandGradient)
            .frame(width: 320, height: 320)
            .blur(radius: 120)
            .opacity(0.35)
            .offset(x: 120, y: -260)
    }

    private var brand: some View {
        VStack(spacing: 14) {
            CardrAIIconMark(size: 72)
            CardrAIWordmark(size: 32)
            Text("Scan cards. Build relationships.")
                .font(.subheadline)
                .foregroundStyle(Theme.inkSecondary)
        }
    }

    private var formCard: some View {
        CardSurface(padding: 22) {
            VStack(alignment: .leading, spacing: 18) {
                Text(mode.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.ink)

                field(
                    icon: "envelope.fill",
                    placeholder: "Email address",
                    text: $email,
                    keyboard: .emailAddress,
                    isSecure: false
                )
                field(
                    icon: "lock.fill",
                    placeholder: "Password",
                    text: $password,
                    keyboard: .default,
                    isSecure: true
                )

                if mode == .signIn {
                    Button("Forgot password?") {
                        Task {
                            if await session.sendPasswordReset(email: email) { showResetSent = true }
                        }
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.primary)
                }

                if let error = session.authError {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(Theme.destructive)
                }

                Button(action: submit) {
                    HStack {
                        if session.isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text(mode.cta).fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(canSubmit ? AnyShapeStyle(Theme.brandGradient) : AnyShapeStyle(Theme.inkSecondary.opacity(0.3)))
                    .foregroundStyle(.white)
                    .clipShape(.rect(cornerRadius: 14))
                }
                .disabled(!canSubmit)

                Button(mode.toggle) {
                    withAnimation(.snappy) {
                        mode = mode == .signIn ? .signUp : .signIn
                        session.authError = nil
                    }
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.inkSecondary)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func field(
        icon: String,
        placeholder: String,
        text: Binding<String>,
        keyboard: UIKeyboardType,
        isSecure: Bool
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(Theme.inkSecondary)
                .frame(width: 20)
            Group {
                if isSecure {
                    SecureField(placeholder, text: text)
                } else {
                    TextField(placeholder, text: text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .background(Theme.surfaceMuted)
        .clipShape(.rect(cornerRadius: 12))
    }

    private func submit() {
        Task {
            switch mode {
            case .signIn: await session.signIn(email: email, password: password)
            case .signUp: await session.signUp(email: email, password: password)
            }
        }
    }
}
