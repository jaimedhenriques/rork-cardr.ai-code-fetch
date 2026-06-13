import SwiftUI
import UIKit

/// Create a meeting note — type it manually or record audio for AI
/// transcription + insights. Mirrors the web `NoteNew` + `NoteRecord` flows.
struct NoteComposerView: View {
    @Environment(SessionStore.self) private var session
    @Environment(DataStore.self) private var data
    @Environment(\.dismiss) private var dismiss

    @State private var recorder = LiveTranscriptionService()
    @State private var title = ""
    @State private var manualNotes = ""
    @State private var isProcessing = false
    @State private var processingStep = ""
    @State private var savedNote: MeetingNote?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    titleField
                    recorderCard
                    liveTranscriptCard
                    manualNotesCard
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle("New Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        recorder.cancel()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") { Task { await saveManual() } }
                        .fontWeight(.semibold)
                        .disabled(!canSaveManual || isProcessing)
                }
            }
            .navigationDestination(item: $savedNote) { note in
                NoteDetailView(note: note)
            }
            .interactiveDismissDisabled(recorder.isRecording || isProcessing)
        }
    }

    private var canSaveManual: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            || !manualNotes.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Title

    private var titleField: some View {
        CardSurface {
            TextField("Meeting title", text: $title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .disabled(recorder.isRecording || isProcessing)
        }
    }

    // MARK: - Recorder

    private var recorderCard: some View {
        CardSurface {
            VStack(spacing: 16) {
                Text(timeString(recorder.duration))
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(recorder.isRecording ? Theme.ink : Theme.inkSecondary)
                    .contentTransition(.numericText())

                if recorder.isRecording {
                    WaveformView(levels: recorder.levels, paused: recorder.isPaused)
                        .frame(height: 44)
                        .padding(.horizontal, 4)
                }

                if isProcessing {
                    VStack(spacing: 10) {
                        ProgressView()
                        Text(processingStep)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.inkSecondary)
                    }
                    .frame(height: 80)
                } else {
                    recordControls
                }

                if recorder.permissionDenied {
                    Text("Microphone access is off. Enable it in Settings to record.")
                        .font(.caption)
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                } else if recorder.authorizationFailed {
                    Text("Speech recognition is unavailable. Enable it in Settings to transcribe live.")
                        .font(.caption)
                        .foregroundStyle(Theme.destructive)
                        .multilineTextAlignment(.center)
                } else if !recorder.isSupported && !recorder.isRecording {
                    Text("Install this app on your device via the Rork App to record audio.")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                } else {
                    Text(recorder.isRecording ? "Listening — words appear live below" : "Record audio for live AI transcription & insights")
                        .font(.caption)
                        .foregroundStyle(Theme.inkSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Live transcript

    @ViewBuilder
    private var liveTranscriptCard: some View {
        if recorder.isRecording || !recorder.transcript.isEmpty {
            CardSurface {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(recorder.isRecording && !recorder.isPaused ? Theme.destructive : Theme.inkSecondary)
                            .frame(width: 8, height: 8)
                            .opacity(recorder.isRecording && !recorder.isPaused ? 1 : 0.4)
                        Text(recorder.isRecording ? "Live transcript" : "Transcript")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.inkSecondary)
                        Spacer()
                        Text("On-device")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(Theme.primary.opacity(0.1))
                            .clipShape(.capsule)
                    }
                    Text(recorder.transcript.isEmpty ? "Start speaking…" : recorder.transcript)
                        .font(.system(size: 15))
                        .foregroundStyle(recorder.transcript.isEmpty ? Theme.inkSecondary : Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .animation(.easeOut(duration: 0.2), value: recorder.transcript)
                }
            }
        }
    }

    private var recordControls: some View {
        HStack(spacing: 28) {
            if recorder.isRecording {
                Button {
                    recorder.isPaused ? recorder.resume() : recorder.pause()
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    Image(systemName: recorder.isPaused ? "play.fill" : "pause.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 56, height: 56)
                        .background(Theme.surfaceMuted)
                        .clipShape(Circle())
                }
                .buttonStyle(PressableButtonStyle())

                Button { Task { await stopAndProcess() } } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 72, height: 72)
                        .background(Theme.destructive)
                        .clipShape(Circle())
                        .shadow(color: Theme.destructive.opacity(0.4), radius: 14, y: 6)
                }
                .buttonStyle(PressableButtonStyle())
            } else {
                Button { Task { await startRecording() } } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 30, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 80, height: 80)
                        .background(Theme.brandGradient)
                        .clipShape(Circle())
                        .shadow(color: Theme.primary.opacity(0.45), radius: 16, y: 8)
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .frame(height: 80)
    }

    // MARK: - Manual notes

    private var manualNotesCard: some View {
        CardSurface {
            VStack(alignment: .leading, spacing: 8) {
                Label("Your notes", systemImage: "pencil")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.inkSecondary)
                TextField("Write your meeting notes…", text: $manualNotes, axis: .vertical)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(4...10)
                    .disabled(isProcessing)
            }
        }
    }

    // MARK: - Actions

    private func startRecording() async {
        let ok = await recorder.start()
        if ok {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func stopAndProcess() async {
        let (liveTranscript, seconds) = recorder.stop()
        isProcessing = true
        defer { isProcessing = false }

        let trimmedLive = liveTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        let transcript: String? = trimmedLive.isEmpty ? nil : trimmedLive

        let combined = [transcript, manualNotes]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n---\n\n")

        var insights: DataStore.NoteInsights?
        if combined.count > 10 {
            processingStep = "Generating insights…"
            insights = await data.generateInsights(transcript: combined, durationSeconds: seconds)
        }

        processingStep = "Saving…"
        let note = await data.addNote(
            title: title,
            manualNotes: manualNotes.isEmpty ? nil : manualNotes,
            transcript: transcript,
            durationSeconds: seconds,
            insights: insights
        )
        if let note {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            savedNote = note
        }
    }

    private func saveManual() async {
        isProcessing = true
        processingStep = "Saving…"
        defer { isProcessing = false }

        var insights: DataStore.NoteInsights?
        if manualNotes.trimmingCharacters(in: .whitespaces).count >= 20 {
            processingStep = "Generating insights…"
            let text = "Title: \(title)\n\n\(manualNotes)"
            insights = await data.generateInsights(transcript: text, durationSeconds: 0)
        }

        let note = await data.addNote(
            title: title,
            manualNotes: manualNotes.isEmpty ? nil : manualNotes,
            transcript: nil,
            durationSeconds: 0,
            insights: insights
        )
        if let note {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            savedNote = note
        }
    }

    private func timeString(_ interval: TimeInterval) -> String {
        let total = Int(interval)
        return String(format: "%02d:%02d", total / 60, total % 60)
    }
}
