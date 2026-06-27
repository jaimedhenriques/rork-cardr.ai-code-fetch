import Foundation
import AVFoundation
import Speech
import Observation

/// Real-time, on-device speech-to-text for the notes recorder. Streams partial
/// results as you speak (Otter/Granola-style) and publishes a live audio level
/// for the waveform. Uses Apple's Speech framework — no network round-trips.
@MainActor
@Observable
final class LiveTranscriptionService: NSObject {
    var isRecording = false
    var isPaused = false
    var duration: TimeInterval = 0
    var transcript = ""
    /// Smoothed 0...1 microphone level, sampled for the waveform bars.
    var levels: [CGFloat] = Array(repeating: 0.05, count: 40)
    var permissionDenied = false
    var authorizationFailed = false

    private let engine = AVAudioEngine()
    private var recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var timer: Timer?
    private var finalizedText = ""
    /// The same tapped audio is written here so it can be uploaded for
    /// server-side speaker diarization after the session ends.
    private var audioFile: AVAudioFile?
    private var recordingURL: URL?

    /// Whether live transcription can run on this device/simulator.
    var isSupported: Bool {
        guard let recognizer, recognizer.isAvailable else { return false }
        return !AVAudioSession.sharedInstance().availableInputs.isNilOrEmpty
    }

    /// Switches the recognition language. Call before `start()`. Falls back to the
    /// device locale if the requested language has no recognizer.
    func setLanguage(_ identifier: String) {
        let candidate = SFSpeechRecognizer(locale: Locale(identifier: identifier))
        recognizer = candidate ?? SFSpeechRecognizer()
    }

    // MARK: - Permissions

    func requestPermissions() async -> Bool {
        let speech = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
        let mic = await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
        if !mic { permissionDenied = true }
        if !speech { authorizationFailed = true }
        return speech && mic
    }

    // MARK: - Control

    func start() async -> Bool {
        guard await requestPermissions() else { return false }
        guard let recognizer, recognizer.isAvailable else {
            authorizationFailed = true
            return false
        }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            return false
        }

        let newRequest = SFSpeechAudioBufferRecognitionRequest()
        newRequest.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            newRequest.requiresOnDeviceRecognition = true
        }
        request = newRequest

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        guard format.channelCount > 0 else { return false }

        // Capture the same audio to a 16-bit PCM WAV for server-side diarization.
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cardr-note-\(UUID().uuidString).wav")
        let fileSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: format.sampleRate,
            AVNumberOfChannelsKey: format.channelCount,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
        ]
        audioFile = try? AVAudioFile(forWriting: url, settings: fileSettings)
        recordingURL = audioFile == nil ? nil : url

        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
            try? self?.audioFile?.write(from: buffer)
            let level = Self.rmsLevel(buffer)
            Task { @MainActor in self?.pushLevel(level) }
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            return false
        }

        finalizedText = ""
        transcript = ""
        duration = 0
        isRecording = true
        isPaused = false
        startTimer()

        task = recognizer.recognitionTask(with: newRequest) { [weak self] result, error in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.finalizedText = self.transcript
                }
            }
        }
        return true
    }

    func pause() {
        guard isRecording, !isPaused else { return }
        engine.pause()
        isPaused = true
        timer?.invalidate()
    }

    func resume() {
        guard isRecording, isPaused else { return }
        try? engine.start()
        isPaused = false
        startTimer()
    }

    /// Stops the session and returns the final transcript, duration in seconds,
    /// and the captured audio (16-bit PCM WAV) for server-side diarization.
    func stop() -> (transcript: String, duration: Int, audio: Data?) {
        timer?.invalidate()
        timer = nil
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        request?.endAudio()
        task?.finish()
        task = nil
        request = nil
        isRecording = false
        isPaused = false
        let finalDuration = Int(duration.rounded())
        let text = transcript.isEmpty ? finalizedText : transcript
        // Closing the AVAudioFile flushes the WAV header before we read it.
        audioFile = nil
        var audio: Data?
        if let url = recordingURL {
            audio = try? Data(contentsOf: url)
            try? FileManager.default.removeItem(at: url)
        }
        recordingURL = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        return (text, finalDuration, audio)
    }

    func cancel() {
        timer?.invalidate()
        timer = nil
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning { engine.stop() }
        task?.cancel()
        task = nil
        request = nil
        isRecording = false
        isPaused = false
        duration = 0
        transcript = ""
        finalizedText = ""
        audioFile = nil
        if let url = recordingURL { try? FileManager.default.removeItem(at: url) }
        recordingURL = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: - Helpers

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isRecording, !self.isPaused else { return }
                self.duration += 0.1
            }
        }
    }

    private func pushLevel(_ level: CGFloat) {
        levels.removeFirst()
        levels.append(max(0.05, min(1, level)))
    }

    private static func rmsLevel(_ buffer: AVAudioPCMBuffer) -> CGFloat {
        guard let channel = buffer.floatChannelData?[0] else { return 0.05 }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return 0.05 }
        var sum: Float = 0
        for i in 0..<count { sum += channel[i] * channel[i] }
        let rms = sqrt(sum / Float(count))
        // Map RMS to a visually pleasing 0...1 range.
        let scaled = CGFloat(min(1, max(0, rms * 12)))
        return scaled
    }
}

private extension Optional where Wrapped == [AVAudioSessionPortDescription] {
    var isNilOrEmpty: Bool { self?.isEmpty ?? true }
}

/// A spoken language the recorder can transcribe live. Identifiers map to
/// `SFSpeechRecognizer` locales; the catalog mirrors the languages Otter/Plaud
/// surface for capture.
nonisolated struct TranscriptionLanguage: Identifiable, Hashable {
    let id: String
    let label: String
    let flag: String

    static let all: [TranscriptionLanguage] = [
        .init(id: "en-US", label: "English (US)", flag: "🇺🇸"),
        .init(id: "en-GB", label: "English (UK)", flag: "🇬🇧"),
        .init(id: "es-ES", label: "Spanish", flag: "🇪🇸"),
        .init(id: "fr-FR", label: "French", flag: "🇫🇷"),
        .init(id: "de-DE", label: "German", flag: "🇩🇪"),
        .init(id: "it-IT", label: "Italian", flag: "🇮🇹"),
        .init(id: "pt-BR", label: "Portuguese", flag: "🇧🇷"),
        .init(id: "nl-NL", label: "Dutch", flag: "🇳🇱"),
        .init(id: "sv-SE", label: "Swedish", flag: "🇸🇪"),
        .init(id: "ar-SA", label: "Arabic", flag: "🇸🇦"),
        .init(id: "hi-IN", label: "Hindi", flag: "🇮🇳"),
        .init(id: "zh-CN", label: "Chinese", flag: "🇨🇳"),
        .init(id: "ja-JP", label: "Japanese", flag: "🇯🇵"),
        .init(id: "ko-KR", label: "Korean", flag: "🇰🇷"),
    ]

    static func named(_ id: String) -> TranscriptionLanguage {
        all.first { $0.id == id } ?? all[0]
    }
}
