import SwiftUI

/// A settings sheet for notes — mirrors the web `NotesDrawer`.
/// Manages auto-transcribe, AI summary, follow-up reminders, and language.
struct NoteSettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage("notes.autoTranscribe") private var autoTranscribe = true
    @AppStorage("notes.aiSummary") private var aiSummary = true
    @AppStorage("notes.followUpReminders") private var followUpReminders = true
    @AppStorage("note.language") private var languageId = "en-US"

    var body: some View {
        NavigationStack {
            Form {
                Section("Recording") {
                    Toggle(isOn: $autoTranscribe) {
                        Label("Auto-transcribe", systemImage: "mic.fill")
                    }
                    .tint(Theme.primary)

                    Toggle(isOn: $aiSummary) {
                        Label("AI summary", systemImage: "sparkles")
                    }
                    .tint(Theme.primary)
                }

                Section("Organization") {
                    Toggle(isOn: $followUpReminders) {
                        Label("Follow-up reminders", systemImage: "bell.fill")
                    }
                    .tint(Theme.primary)
                }

                Section("Transcription language") {
                    Picker("Language", selection: $languageId) {
                        ForEach(TranscriptionLanguage.all) { language in
                            Text("\(language.flag)  \(language.label)").tag(language.id)
                        }
                    }
                }
            }
            .navigationTitle("Notes Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
        }
    }
}
