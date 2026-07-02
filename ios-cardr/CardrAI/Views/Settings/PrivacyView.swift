import SwiftUI

/// Privacy policy — mirrors the web `Privacy` page.
struct PrivacyView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Last updated: May 26, 2026")
                    .font(.caption)
                    .foregroundStyle(Theme.inkSecondary)

                section("Who we are") {
                    Text("Cardr (\"we\", \"us\") provides a business-card scanner, AI note-taker, and lead management app at cardr.ai. This policy explains what data we collect, why, and how you control it.")
                }

                section("Data we collect") {
                    bullet("Account: email, name, password hash, sign-in provider.")
                    bullet("Contacts you scan or create: names, emails, phones, company, role, notes, photos of cards.")
                    bullet("Meeting notes: text you write and, if you opt in, audio you record for transcription.")
                    bullet("Usage data: minimal device and app-event logs to keep the service running and debug crashes.")
                    bullet("Billing: handled by Stripe; we never see your card number.")
                }

                section("How we use it") {
                    bullet("Provide the scan, transcription, enrichment, and export features you request.")
                    bullet("Sync your data across your devices.")
                    bullet("Send service emails (receipts, security alerts). Marketing only if you opt in.")
                    bullet("Improve reliability and prevent abuse.")
                    Text("We do not sell your data and do not use it to train third-party AI models.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.ink.opacity(0.85))
                }

                section("AI processing") {
                    Text("Card images, transcripts, and prompts you submit to AI features are sent to our AI providers (Google, OpenAI) strictly to return the result to you. Providers are contractually barred from training on your content.")
                }

                section("Sharing") {
                    Text("We share data only with infrastructure providers needed to run the app (hosting, database, email, payments, AI). A current list is available on request.")
                }

                section("Your rights") {
                    bullet("Access, export, or correct your data from Settings.")
                    bullet("Delete your account and all associated data at any time via Settings → Delete account.")
                    Button {
                        openURL(URL(string: "mailto:privacy@cardr.ai")!)
                    } label: {
                        Text("Contact privacy@cardr.ai for any GDPR/CCPA request.")
                            .font(.subheadline)
                            .foregroundStyle(Theme.primary)
                            .underline()
                    }
                    .buttonStyle(.plain)
                }

                section("Retention") {
                    Text("We keep your data while your account is active. On deletion, content is removed within 30 days, except where law requires us to retain billing records.")
                }

                section("Children") {
                    Text("Cardr is not directed to children under 13 and we do not knowingly collect their data.")
                }

                section("Contact") {
                    Button {
                        openURL(URL(string: "mailto:privacy@cardr.ai")!)
                    } label: {
                        Text("Questions? Email privacy@cardr.ai")
                            .font(.subheadline)
                            .foregroundStyle(Theme.primary)
                            .underline()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 40)
        }
        .background(Theme.background)
        .navigationTitle("Privacy Policy")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.ink)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Circle().fill(Theme.primary).frame(width: 5, height: 5).padding(.top, 7)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Theme.ink.opacity(0.85))
        }
    }
}
